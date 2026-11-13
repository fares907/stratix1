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
    result = make_router(cfg, store, handler).complete("ceo", [], chain=["gemini:pro", "groq:big"])
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
    chain = ["gemini:pro", "groq:big"]
    assert router.complete("ceo", [], chain=chain).used_fallback
    router.complete("ceo", [], chain=chain)
    # تاني مرة مايحاولش في gemini لأنه موقوف 120 ثانية
    assert seen == ["gemini-2.5-pro", "openai/gpt-oss-120b", "openai/gpt-oss-120b"]


def test_router_respects_daily_limit(cfg):
    store = MemoryStore()
    router = make_router(cfg, store, lambda req: _reply())
    spec = cfg.model("gemini:pro")
    router.tracker.seed(spec.key, spec.rpd)
    assert router.complete("ceo", [], chain=["gemini:pro", "groq:big"]).used_fallback


def test_router_with_no_keys_falls_back_to_keyless_provider(cfg):
    seen = []
    def handler(req):
        seen.append((str(req.url), req.headers.get("authorization")))
        return _reply("أهلا")
    result = make_router(cfg, MemoryStore(), handler, env={}).complete("ceo", [], chain=["gemini:pro", "cerebras:llama70b"])
    assert result.model_key == "pollinations:openai" and result.used_fallback
    assert seen == [("https://text.pollinations.ai/openai", None)]


def test_router_reaches_groq_through_the_gateway_without_a_local_key(cfg):
    seen = []
    def handler(req):
        seen.append((str(req.url), req.headers.get("authorization")))
        return _reply()
    router = ModelRouter(cfg, MemoryStore(), env={}, http=httpx.Client(transport=httpx.MockTransport(handler)),
                         gateway=("https://gw.example/functions/v1/agents-gateway", lambda: "oidc-token"))
    result = router.complete("finance", [], chain=["groq:big", "cerebras:llama70b"], sensitive=True)
    assert result.model_key == "groq:big" and not result.used_fallback
    assert seen == [("https://gw.example/functions/v1/agents-gateway/llm/groq/chat/completions", "Bearer oidc-token")]


def test_sensitive_request_with_no_private_provider_raises(cfg):
    router = make_router(cfg, MemoryStore(), lambda req: _reply(), env={})
    with pytest.raises(AllModelsUnavailable) as err:
        router.complete("support", [], chain=["groq:big", "cerebras:llama70b"], sensitive=True)
    assert "حساسة" in err.value.reasons["pollinations:openai"]


def test_sensitive_request_never_reaches_training_provider(cfg):
    seen = []
    def handler(req):
        seen.append(json.loads(req.content)["model"])
        return _reply()
    make_router(cfg, MemoryStore(), handler).complete(
        "support", [], chain=["gemini:flash", "groq:big"], sensitive=True
    )
    assert seen == ["openai/gpt-oss-120b"]


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
    assert msg["model_key"] == "groq:big"

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


def test_scout_query_searches_around_the_city_center():
    q = build_query(["Banha"], ["restaurant"], include_shops=True, center=(30.4628, 31.1856), radius_m=10000)
    assert 'nwr(around:10000,30.4628,31.1856)["shop"]["name"];' in q and "area" not in q


def test_scout_skips_big_chains():
    chain = {"type": "node", "id": 1, "tags": {"name": "ماكدونالدز", "amenity": "restaurant", "phone": "19991"}}
    brand = {"type": "node", "id": 2, "tags": {"name": "Buffalo", "brand": "Buffalo", "phone": "+20 10 1111 2222"}}
    local = {"type": "node", "id": 3, "tags": {"name": "مركز زكريا", "shop": "car_repair", "phone": "+20 122 360 1541"}}
    assert [l["name"] for l in parse_leads([chain, brand, local], "بنها")] == ["مركز زكريا"]


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
    assert seen == ["maps.mail.ru", "overpass-api.de", "overpass.private.coffee"]


def test_scout_gives_up_with_a_clear_error():
    from stratix_agents.scout import fetch
    waits = []
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(504)))
    with pytest.raises(RuntimeError, match="مزحومة"):
        fetch("q", client, sleep=waits.append)
    assert waits == [20]


def test_scout_keeps_only_places_without_website_but_with_contact():
    elements = json.loads((Path(__file__).parent / "osm_sample.json").read_text(encoding="utf-8"))
    leads = parse_leads(elements, "بنها")
    assert [lead["name"] for lead in leads] == ["مطعم الشيف", "صيدلية النور"]
    assert leads[1]["lat"] == 30.46 and leads[0]["phone"] == "+20 10 0000 0001"



@pytest.mark.parametrize("utc_hour, ok", [(5, False), (6, True), (14, True), (20, True), (21, False), (2, False)])
def test_working_hours_8_to_11pm_cairo(cfg, utc_hour, ok):
    from datetime import datetime, timezone
    from stratix_agents.runtime import within_working_hours
    # نوفمبر: القاهرة = UTC+2، فـ 6 UTC = 8 الصبح و21 UTC = 11 بالليل
    now = datetime(2026, 11, 11, utc_hour, 30, tzinfo=timezone.utc)
    assert within_working_hours(cfg.rules, now)[0] is ok


def test_outside_hours_nothing_runs(monkeypatch, capsys):
    from stratix_agents import __main__ as cli
    monkeypatch.setattr(cli, "within_working_hours", lambda rules: (False, "الساعة 23:00"))
    called = []
    monkeypatch.setitem(cli.COMMANDS, "morning", lambda cfg: called.append(1))
    cli.main(["morning"])
    assert called == [] and "برّا مواعيد العمل" in capsys.readouterr().out



def test_site_facts_become_readable_sentences_for_the_finance_agent():
    from stratix_agents.sitedb import fetch_site_facts
    data = {"ledger": {"thisMonth": {"income": 5000, "expense": 1200, "net": 3800}, "thisYear": {"income": 20000, "expense": 6000, "net": 14000}},
            "invoices": {"total": 3, "egpThisYear": 900, "usdThisYear": 12},
            "bookings": {"total": 7, "byStatus": {"new": 2, "contacted": 3, "closed": 2}, "byPaymentStatus": {"paid": 4, "unpaid": 2, "awaiting_review": 1}},
            "contacts": {"total": 5, "byStatus": {"new": 1}}}
    seen = []
    def handler(req):
        seen.append(req.headers["authorization"])
        return httpx.Response(200, json=data)
    facts = fetch_site_facts("tok", httpx.Client(transport=httpx.MockTransport(handler)))
    assert seen == ["Bearer tok"]
    assert "دخل 5,000 جنيه" in facts["finance"] and "صافي 3,800 جنيه" in facts["finance"]
    assert "لسه مادفعش 2" in facts["finance"] and "إجمالي 7" in facts["bookings"]


def test_each_agent_sees_only_the_sections_it_is_allowed(cfg):
    from stratix_agents.agent import Agent
    from stratix_agents.sitedb import facts_for_agents
    sections = {"finance": "FIN", "bookings": "BOOK", "contacts": "CONT", "stats": "STAT"}
    roster = {a.id: Agent(a, cfg, None, None) for a in cfg.agents.values()}
    out = facts_for_agents(sections, roster)
    assert out["finance"] == "FIN"                                   # طارق: الحسابات بس
    assert "BOOK" in out["support"] and "CONT" in out["support"]     # منى: الحجوزات والطلبات
    assert "FIN" not in out["support"]                               # ومش الحسابات
    assert out["projects"] == "BOOK" and out["analytics"] == "STAT"
    assert all(k in out["ceo"] for k in ("FIN", "BOOK", "CONT", "STAT"))  # المدير: الكل
    assert "writer" not in out and "scout" not in out                # الباقي: ولا حاجة



def test_developers_see_the_code_on_github():
    from stratix_agents.devteam import GitHub, repo_overview
    def handler(req):
        path = req.url.path
        if path.endswith("/commits"):
            return httpx.Response(200, json=[{"commit": {"message": "Fix booking form\n\nmore", "author": {"date": "2026-11-10T10:00:00Z"}}}])
        if path.endswith("/issues"):
            return httpx.Response(200, json=[{"number": 3, "title": "Slow page"}, {"number": 4, "title": "PR", "pull_request": {}}])
        if path.endswith("/pulls"):
            return httpx.Response(200, json=[{"number": 7, "title": "Bump deps"}])
        return httpx.Response(404)
    text = repo_overview(GitHub("t", "o/r", httpx.Client(transport=httpx.MockTransport(handler))))
    assert "Fix booking form" in text and "#3 Slow page" in text and "#7 Bump deps" in text
    assert "#4" not in text  # الـ PR مش بيتحسب Issue



def test_router_waits_a_few_seconds_when_the_provider_says_so(cfg):
    calls, waits = [], []
    def handler(req):
        calls.append(1)
        if len(calls) <= 2:  # الموديل الكبير والصغير الاتنين مشغولين
            return httpx.Response(429, headers={"retry-after": "6"})
        return _reply("تمام")
    t = [0.0]
    router = ModelRouter(cfg, MemoryStore(), env={"GROQ_API_KEY": "k"}, tracker=RateTracker(lambda: t[0]),
                         http=httpx.Client(transport=httpx.MockTransport(handler)),
                         sleep=lambda s: (waits.append(s), t.__setitem__(0, t[0] + s)))
    out = router.complete("support", [], chain=["groq:big"], sensitive=True)
    assert out.text == "تمام" and waits == [7.0]


def test_router_retries_without_json_mode_on_groq_400(cfg):
    bodies = []
    def handler(req):
        body = json.loads(req.content)
        bodies.append("response_format" in body)
        return httpx.Response(400, json={"error": "json_validate_failed"}) if "response_format" in body else _reply("نص عادي")
    out = make_router(cfg, MemoryStore(), handler, env={"GROQ_API_KEY": "k"}).complete(
        "ceo", [], chain=["groq:small"], json_mode=True)
    assert out.text == "نص عادي" and bodies == [True, False]


def test_router_waits_for_groq_instead_of_weak_keyless_fallback(cfg):
    hosts, waits = [], []
    def handler(req):
        hosts.append(req.url.host)
        if req.url.host == "api.groq.com" and hosts.count("api.groq.com") <= 2:
            return httpx.Response(429, headers={"retry-after": "5"})
        return _reply("قرار كامل")
    t = [0.0]
    router = ModelRouter(cfg, MemoryStore(), env={"GROQ_API_KEY": "k"}, tracker=RateTracker(lambda: t[0]),
                         http=httpx.Client(transport=httpx.MockTransport(handler)),
                         sleep=lambda s: (waits.append(s), t.__setitem__(0, t[0] + s)))
    out = router.complete("ceo", [], chain=["groq:big"])
    assert out.model_key.startswith("groq:") and "text.pollinations.ai" not in hosts and waits == [6.0]


def test_security_finds_exposed_env_and_ignores_spa_fallback():
    from stratix_agents.site import Report, check_exposure
    def handler(req):
        if req.url.path == "/.env":
            return httpx.Response(200, text="DATABASE_URL=mysql://secret")
        if req.url.scheme == "http":
            return httpx.Response(301, headers={"location": "https://stratix.website/"})
        return httpx.Response(200, text="<!doctype html><html>site</html>")
    report = Report()
    check_exposure(report, "https://stratix.website", httpx.Client(transport=httpx.MockTransport(handler)))
    crit = [f.text for f in report.findings if f.severity == "critical"]
    assert crit and ".env" in crit[0] and ".git" not in crit[0]
    assert any("HTTPS" in f.text and f.severity == "ok" for f in report.findings)


def test_pdf_report_html_is_safe_and_keeps_latin_words_in_order():
    from stratix_agents.pdfreport import build_html
    data = {
        "date": "2026-11-11", "summary": "ملخص <script>alert(1)</script>",
        "kpis": [{"label": "عملاء", "value": 4, "hint": "", "tone": "ok"}],
        "sales": {"rows": [["إجمالي", 4]]},
        "site": [{"area": "الأمان", "status": "ok", "status_label": "سليم", "text": "اشتراك Railway ساري"}],
        "ideas": [], "tasks_done": [], "approvals": [], "highlights": [], "risks": [], "recommendations": [],
    }
    html = build_html(data)
    assert "<script>" not in html and "&lt;<bdi dir='ltr'>script</bdi>&gt;" in html
    assert "<bdi dir='ltr'>Railway</bdi>" in html and "class='pill ok'" in html and "class='kpi ok'" in html
    assert "الأربعاء، 11 نوفمبر 2026" in html
    assert "✅" not in build_html({**data, "summary": "تم ✅"})


def test_held_today_only_counts_done_meetings_of_that_kind_today():
    from datetime import datetime, timedelta, timezone
    from stratix_agents.__main__ import held_today

    now = datetime.now(timezone.utc).isoformat()
    old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    assert held_today([{"kind": "evening", "status": "done", "started_at": now}], "evening")
    assert not held_today([{"kind": "evening", "status": "failed", "started_at": now}], "evening")
    assert not held_today([{"kind": "morning", "status": "done", "started_at": now}], "evening")
    assert not held_today([{"kind": "evening", "status": "done", "started_at": old}], "evening")
