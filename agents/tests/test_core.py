import json
from pathlib import Path

import httpx
import pytest

from stratix_agents import config as config_mod
from stratix_agents.agent import Agent, AgentInactive, NotAllowed
from stratix_agents.guard import check_message
from stratix_agents.ratelimit import RateTracker
from stratix_agents.router import AllModelsUnavailable, Halted, ModelRouter
from stratix_agents.scout import build_query, parse_leads
from stratix_agents.store import MemoryStore

ENV = {k: "test-key" for k in ("GEMINI_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "OPENROUTER_API_KEY")}


@pytest.fixture
def cfg():
    return config_mod.load()


def _reply(text="{}", status=200, headers=None):
    body = {"choices": [{"message": {"content": text}}], "usage": {"prompt_tokens": 3, "completion_tokens": 5}}
    return httpx.Response(status, json=body, headers=headers or {})


def make_router(cfg, store, handler, env=ENV, clock=None):
    tracker = RateTracker(clock) if clock else RateTracker()
    return ModelRouter(cfg, store, env=env, http=httpx.Client(transport=httpx.MockTransport(handler)), tracker=tracker)


# ── config ───────────────────────────────────────────────
def test_team_has_15_agents_each_with_two_providers(cfg):
    assert len(cfg.agents) == 15
    for a in cfg.agents.values():
        assert cfg.model(a.primary).provider != cfg.model(a.fallback).provider


def test_sensitive_agent_cannot_use_training_provider(tmp_path, cfg):
    for name in ("providers.yaml", "rules.yaml"):
        (tmp_path / name).write_text((config_mod.CONFIG_DIR / name).read_text(encoding="utf-8"), encoding="utf-8")
    (tmp_path / "team.yaml").write_text(
        "agents:\n  - {id: x, name: س, title: t, department: d, primary: groq:llama70b,"
        " fallback: gemini:flash, tools: [], sensitive: true}\n",
        encoding="utf-8",
    )
    with pytest.raises(config_mod.ConfigError):
        config_mod.load(tmp_path)


# ── router ───────────────────────────────────────────────
def test_router_uses_primary(cfg):
    store = MemoryStore()
    seen = []
    def handler(req):
        seen.append(json.loads(req.content)["model"])
        return _reply("أهلا")
    result = make_router(cfg, store, handler).complete("ceo", [], chain=["gemini:pro", "groq:llama70b"])
    assert result.text == "أهلا" and not result.used_fallback
    assert seen == ["gemini-2.5-pro"]
    assert store.tables["llm_calls"][0]["status"] == "ok"


def test_router_falls_back_on_429_and_cools_down(cfg):
    store = MemoryStore()
    seen = []
    def handler(req):
        model = json.loads(req.content)["model"]
        seen.append(model)
        if model == "gemini-2.5-pro":
            return httpx.Response(429, headers={"retry-after": "120"})
        return _reply("احتياطي")
    router = make_router(cfg, store, handler)
    chain = ["gemini:pro", "groq:llama70b"]
    assert router.complete("ceo", [], chain=chain).used_fallback
    router.complete("ceo", [], chain=chain)
    # تاني مرة مايحاولش في gemini لأنه موقوف 120 ثانية
    assert seen == ["gemini-2.5-pro", "llama-3.3-70b-versatile", "llama-3.3-70b-versatile"]


def test_router_respects_daily_limit(cfg):
    store = MemoryStore()
    router = make_router(cfg, store, lambda req: _reply())
    spec = cfg.model("gemini:pro")
    router.tracker.seed(spec.key, spec.rpd)
    assert router.complete("ceo", [], chain=["gemini:pro", "groq:llama70b"]).used_fallback


def test_router_with_no_keys_falls_back_to_keyless_provider(cfg):
    seen = []
    def handler(req):
        seen.append((str(req.url), req.headers.get("authorization")))
        return _reply("أهلا")
    result = make_router(cfg, MemoryStore(), handler, env={}).complete("ceo", [], chain=["gemini:pro", "groq:llama70b"])
    assert result.model_key == "pollinations:openai" and result.used_fallback
    assert seen == [("https://text.pollinations.ai/openai", None)]


def test_router_uses_github_models_with_actions_token(cfg):
    seen = []
    def handler(req):
        seen.append(str(req.url))
        return _reply()
    result = make_router(cfg, MemoryStore(), handler, env={"GITHUB_TOKEN": "t"}).complete(
        "support", [], chain=["groq:llama70b", "cerebras:llama70b"], sensitive=True)
    assert result.model_key == "github:mini"
    assert seen == ["https://models.github.ai/inference/chat/completions"]


def test_sensitive_request_with_no_private_provider_raises(cfg):
    router = make_router(cfg, MemoryStore(), lambda req: _reply(), env={})
    with pytest.raises(AllModelsUnavailable) as err:
        router.complete("support", [], chain=["groq:llama70b", "cerebras:llama70b"], sensitive=True)
    assert "حساسة" in err.value.reasons["pollinations:openai"]


def test_sensitive_request_never_reaches_training_provider(cfg):
    seen = []
    def handler(req):
        seen.append(json.loads(req.content)["model"])
        return _reply()
    make_router(cfg, MemoryStore(), handler).complete(
        "support", [], chain=["gemini:flash", "groq:llama70b"], sensitive=True
    )
    assert seen == ["llama-3.3-70b-versatile"]


def test_kill_switch_stops_router(cfg):
    store = MemoryStore()
    store.halted = True
    with pytest.raises(Halted):
        make_router(cfg, store, lambda req: _reply()).complete("ceo", [], chain=["gemini:pro"])


def test_minute_limit_resets_after_a_minute(cfg):
    now = [0.0]
    tracker = RateTracker(lambda: now[0])
    spec = cfg.model("gemini:pro")
    for _ in range(spec.rpm):
        tracker.record(spec)
    assert tracker.why_blocked(spec)
    now[0] = 61
    assert tracker.why_blocked(spec) is None


# ── agent ────────────────────────────────────────────────
def test_agent_records_speech_and_checks_status(cfg):
    store = MemoryStore()
    reply = json.dumps({"say": "نبدأ ببنها", "reasoning": "قريبة", "confidence": "high", "unknowns": []})
    agent = Agent(cfg.agents["ceo"], cfg, make_router(cfg, store, lambda r: _reply(reply)), store)
    out = agent.think("إيه الخطة؟", meeting_id=1)
    msg = store.tables["messages"][0]
    assert out["say"] == msg["content"] == "نبدأ ببنها"
    assert msg["model_key"] == "gemini:pro"

    store.insert("agents", {"id": "ceo", "status": "paused"})
    with pytest.raises(AgentInactive):
        agent.think("تاني")


def test_agent_non_json_reply_is_low_confidence(cfg):
    store = MemoryStore()
    agent = Agent(cfg.agents["ceo"], cfg, make_router(cfg, store, lambda r: _reply("كلام عادي")), store)
    assert agent.think("؟")["confidence"] == "low"


def test_agent_tool_permissions(cfg):
    store = MemoryStore()
    agent = Agent(cfg.agents["writer"], cfg, make_router(cfg, store, lambda r: _reply()), store)
    agent.require("draft_message")
    with pytest.raises(NotAllowed):
        agent.require("send_message")


# ── guard ────────────────────────────────────────────────
@pytest.mark.parametrize(
    "text, ok",
    [
        ("الموقع بيبدأ من 2000 جنيه", True),
        ("السعر ٢٥٠٠ جنيه بس", True),
        ("نعملك موقع بـ 1500 جنيه", False),
        ("السعر 5 ألف جنيه", False),
        ("هنسلمك الموقع خلال 3 أيام", False),
        ("عندنا خصم 20%", False),
        ("أهلا يا فندم، لاحظنا إن المطعم مالوش موقع", True),
    ],
)
def test_guard(text, ok):
    assert check_message(text, price_min=2000, price_max=3000).ok is ok


# ── scout ────────────────────────────────────────────────
def test_scout_query_targets_every_city_name():
    q = build_query(["Banha", "Benha", "بنها"], ["restaurant", "cafe"], include_shops=True)
    assert '"name:en"~"^(Banha|Benha|بنها)$"' in q and '"name"~"^(Banha|Benha|بنها)$"' in q
    assert "restaurant|cafe" in q and '["shop"]' in q


def test_scout_tries_other_servers_when_busy():
    from stratix_agents.scout import fetch
    seen, waits = [], []
    def handler(req):
        seen.append(req.url.host)
        if req.url.host == "overpass.private.coffee":
            return httpx.Response(200, json={"elements": [{"type": "node", "id": 1}]})
        return httpx.Response(502, text="busy")
    out = fetch("q", httpx.Client(transport=httpx.MockTransport(handler)), sleep=waits.append)
    assert out == [{"type": "node", "id": 1}] and waits == []
    assert seen == ["overpass-api.de", "overpass.kumi.systems", "overpass.private.coffee"]


def test_scout_gives_up_with_a_clear_error():
    from stratix_agents.scout import fetch
    waits = []
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(504)))
    with pytest.raises(RuntimeError, match="مزحومة"):
        fetch("q", client, sleep=waits.append)
    assert waits == [20, 40]


def test_scout_keeps_only_places_without_website_but_with_contact():
    elements = json.loads((Path(__file__).parent / "osm_sample.json").read_text(encoding="utf-8"))
    leads = parse_leads(elements, "بنها")
    assert [lead["name"] for lead in leads] == ["مطعم الشيف", "صيدلية النور"]
    assert leads[1]["lat"] == 30.46 and leads[0]["phone"] == "+20 10 0000 0001"



@pytest.mark.parametrize("utc_hour, ok", [(5, False), (6, True), (14, True), (15, False), (20, False)])
def test_working_hours_8_to_5_cairo(cfg, utc_hour, ok):
    from datetime import datetime, timezone
    from stratix_agents.runtime import within_working_hours
    # نوفمبر: القاهرة = UTC+2، فـ 6 UTC = 8 الصبح و15 UTC = 5 العصر
    now = datetime(2026, 11, 11, utc_hour, 30, tzinfo=timezone.utc)
    assert within_working_hours(cfg.rules, now)[0] is ok


def test_outside_hours_nothing_runs(monkeypatch, capsys):
    from stratix_agents import __main__ as cli
    monkeypatch.setattr(cli, "within_working_hours", lambda rules: (False, "الساعة 23:00"))
    called = []
    monkeypatch.setitem(cli.COMMANDS, "morning", lambda cfg: called.append(1))
    cli.main(["morning"])
    assert called == [] and "برّا مواعيد العمل" in capsys.readouterr().out
