"""اختبارات اليوم كله: الاجتماع، المبيعات، الوارد، الموافقات، الموقع، التقرير."""

import json
from datetime import date, datetime, timedelta, timezone

import httpx
import pytest

from stratix_agents import config as config_mod
from stratix_agents import meeting, report, sales, site
from stratix_agents.mailer import Inbound, normalize_egypt_phone
from stratix_agents.router import ModelRouter
from stratix_agents.runtime import Company
from stratix_agents.store import MemoryStore

ENV = {k: "k" for k in ("GEMINI_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "OPENROUTER_API_KEY")}


class ScriptedLLM:
    """بيرد حسب كلمة في الـ prompt، ويسجّل كل الطلبات."""

    def __init__(self, rules):
        self.rules = rules
        self.prompts = []

    def __call__(self, request):
        body = json.loads(request.content)
        prompt = body["messages"][-1]["content"]
        self.prompts.append(prompt)
        for needle, reply in self.rules:
            if needle in prompt:
                content = reply if isinstance(reply, str) else json.dumps(reply, ensure_ascii=False)
                return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(
            {"say": "تمام", "reasoning": "", "confidence": "high", "unknowns": []})}}]})


def make_company(llm) -> Company:
    cfg = config_mod.load()
    store = MemoryStore()
    router = ModelRouter(cfg, store, env=ENV, http=httpx.Client(transport=httpx.MockTransport(llm)))
    return Company(cfg, store, router, env={})


class FakeMailer:
    def __init__(self, inbox=()):
        self.sent = []
        self._inbox = list(inbox)

    def send(self, to, subject, body, *, in_reply_to=None):
        self.sent.append({"to": to, "subject": subject, "body": body, "in_reply_to": in_reply_to})
        return "<id@test>"

    def unread(self, limit=30):
        items, self._inbox = self._inbox, []
        return items


def say(text, **extra):
    return {"say": text, "reasoning": "سبب", "confidence": "high", "unknowns": [], **extra}


# ── الاجتماع ──────────────────────────────────────────────
def test_meeting_full_flow_with_proposals_and_tasks():
    llm = ScriptedLLM([
        ("افتح الاجتماع", say("نركز على بنها")),
        ("اعرض شغلك", say("شغلي ماشي", proposal="نركز على العيادات الأول")),
        ("اعترضي", say("فكرة العيادات محتاجة أرقام", ask=["scout"])),
        ("الناقدة قالت", say("عندي 40 عيادة في القائمة")),
        ("اقفل الاجتماع", say("القرار: عيادات الأول",
                              tasks=[{"agent_id": "writer", "title": "رسايل للعيادات"}],
                              proposals=[{"id": "__PID__", "decision": "approved", "reason": "منطقية"}],
                              needs_approval=[{"summary": "باقة 3500", "reason": "برّا الأسعار"}])),
    ])
    company = make_company(llm)

    # رقم أول فكرة بيتعرف بعد ما تتسجل؛ نخلي الرد يستخدم أول رقم
    original = llm.__call__
    def patched(request):
        response = original(request)
        if b"\\u0627\\u0642\\u0641\\u0644" in request.content or "اقفل الاجتماع" in request.content.decode():
            first = company.store.tables["proposals"][0]["id"]
            text = response.json()["choices"][0]["message"]["content"].replace('"__PID__"', str(first))
            return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})
        return response
    company.router.http = httpx.Client(transport=httpx.MockTransport(patched))

    mid = meeting.run(company, {"_company": "أرقام"})
    store = company.store
    assert store.select("meetings", id=mid)[0]["status"] == "done"
    kinds = [m["kind"] for m in store.tables["messages"]]
    assert "objection" in kinds and "decision" in kinds
    assert len(store.tables["proposals"]) == 13  # كل موظف غير المدير والناقدة
    assert store.tables["proposals"][0]["status"] == "approved"
    assert store.tables["tasks"][0]["agent_id"] == "writer"
    assert store.tables["approvals"][0]["kind"] == "decision"
    # الناقدة سألت الكشّاف، فهو رد عليها
    objection = next(m for m in store.tables["messages"] if m["kind"] == "objection")
    assert any(m.get("reply_to") == objection["id"] and m["agent_id"] == "scout" for m in store.tables["messages"])


def test_meeting_skips_paused_agents():
    company = make_company(ScriptedLLM([]))
    company.store.tables["agents"] = [
        {"id": a.id, "name": a.name, "title": a.title, "department": a.department,
         "primary_model": a.primary, "fallback_model": a.fallback, "tools": list(a.tools),
         "status": "paused" if a.id == "writer" else "active"}
        for a in company.config.agents.values()
    ]
    meeting.run(company, {})
    assert not any(m["agent_id"] == "writer" for m in company.store.tables["messages"])


# ── المبيعات ─────────────────────────────────────────────
def _lead(store, **kw):
    return store.insert("leads", {"name": "مطعم", "category": "restaurant", "city": "بنها",
                                  "status": "new", "source": "openstreetmap", **kw})


def test_qualify_rejects_leads_without_contact_and_respects_suppression():
    company = make_company(ScriptedLLM([]))
    s = company.store
    good = _lead(s, email="a@x.com")
    bad = _lead(s, phone="123")
    blocked = _lead(s, email="b@x.com")
    s.insert("suppression_list", {"contact": "b@x.com"})
    sales.qualify(company)
    assert s.select("leads", id=good["id"])[0]["status"] == "qualified"
    assert s.select("leads", id=bad["id"])[0]["status"] == "rejected"
    assert s.select("leads", id=blocked["id"])[0]["status"] == "unsubscribed"


def test_outreach_sends_email_prepares_whatsapp_and_holds_promises():
    llm = ScriptedLLM([
        ("كافيه الوعد", say("هنسلمك الموقع خلال 3 أيام بـ 1000 جنيه")),
        ("اكتب", say("أهلا، لاحظنا إن المكان مالوش موقع. تحب نعملك واحد؟")),
    ])
    company = make_company(llm)
    s = company.store
    _lead(s, name="مطعم الإيميل", email="r@x.com", status="qualified", priority=5)
    _lead(s, name="صيدلية الواتس", phone="01012345678", status="qualified", priority=4)
    _lead(s, name="كافيه الوعد", email="c@x.com", status="qualified", priority=3)
    mailer = FakeMailer()

    stats = sales.outreach(company, mailer)
    assert stats == {"sent": 1, "whatsapp_ready": 1, "held": 1, "skipped": 0}
    assert mailer.sent[0]["to"] == "r@x.com"
    assert "إلغاء" in mailer.sent[0]["body"]  # طريقة إلغاء الاشتراك في كل رسالة
    held = s.select("approvals")[0]
    assert any("تسليم" in r for r in held["reasons"]) and held["payload"]["to"] == "c@x.com"


def test_outreach_respects_daily_limit():
    company = make_company(ScriptedLLM([("اكتب", say("أهلا يا فندم"))]))
    s = company.store
    for i in range(20):
        _lead(s, name=f"م{i}", email=f"m{i}@x.com", status="qualified")
    mailer = FakeMailer()
    sales.outreach(company, mailer)
    assert len(mailer.sent) == company.rule("outreach", "daily_limit")
    sales.outreach(company, mailer)  # تاني مرة في نفس اليوم: مفيش زيادة
    assert len(mailer.sent) == company.rule("outreach", "daily_limit")


def test_follow_up_after_four_days_once():
    company = make_company(ScriptedLLM([("اكتب", say("بنفكّرك برسالتنا"))]))
    s = company.store
    lead = _lead(s, email="f@x.com", status="contacted")
    old = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    s.insert("outreach_messages", {"lead_id": lead["id"], "direction": "out", "status": "sent",
                                   "channel": "email", "body": "x", "sent_at": old, "created_at": old})
    mailer = FakeMailer()
    sales.outreach(company, mailer)
    assert len(mailer.sent) == 1 and mailer.sent[0]["subject"].startswith("بخصوص")
    sales.outreach(company, mailer)
    assert len(mailer.sent) == 1


def test_inbox_unsubscribe_answer_and_hold():
    llm = ScriptedLLM([
        ("مهتم جدا", say("أهلا بيك! الأسعار بتبدأ من 2000 جنيه. نتكلم إمتى؟", interest="interested")),
        ("هتخلصوه إمتى", say("هنسلمه في أسبوع", interest="question", needs_human=True)),
    ])
    company = make_company(llm)
    s = company.store
    a = _lead(s, email="a@x.com", status="contacted")
    _lead(s, email="b@x.com", status="contacted")
    c = _lead(s, email="c@x.com", status="contacted")
    mailer = FakeMailer([
        Inbound("1", "a@x.com", "Re", "انا مهتم جدا", "<m1>"),
        Inbound("2", "b@x.com", "Re", "إلغاء", "<m2>"),
        Inbound("3", "c@x.com", "Re", "هتخلصوه إمتى؟", "<m3>"),
        Inbound("4", "stranger@x.com", "hi", "spam", "<m4>"),
    ])
    stats = sales.inbox(company, mailer)
    assert stats == {"replies": 3, "unsubscribed": 1, "answered": 1, "held": 1}
    assert mailer.sent[0]["to"] == "a@x.com" and mailer.sent[0]["in_reply_to"] == "<m1>"
    assert s.select("leads", id=a["id"])[0]["status"] == "interested"
    assert s.select("suppression_list")[0]["contact"] == "b@x.com"
    assert s.select("approvals")[0]["payload"]["to"] == "c@x.com"

    # رئيس مجلس الإدارة وافق ← بيتبعت
    s.update("approvals", {"status": "approved"}, id=s.select("approvals")[0]["id"])
    assert sales.execute_approved(company, mailer) == 1
    assert mailer.sent[-1]["to"] == "c@x.com"
    assert s.select("approvals")[0]["status"] == "executed"


def test_rejected_approval_is_never_sent():
    company = make_company(ScriptedLLM([]))
    company.store.insert("approvals", {"agent_id": "support", "kind": "message", "status": "rejected",
                                       "payload": {"channel": "email", "to": "x@x.com", "body": "x", "lead_id": 1}})
    mailer = FakeMailer()
    assert sales.execute_approved(company, mailer) == 0 and mailer.sent == []


def test_kill_switch_blocks_sending():
    company = make_company(ScriptedLLM([("اكتب", say("أهلا"))]))
    _lead(company.store, email="a@x.com", status="qualified")
    company.store.halted = True
    with pytest.raises(Exception):
        sales.outreach(company, FakeMailer())


@pytest.mark.parametrize("raw, expected", [
    ("01012345678", "201012345678"), ("+20 10 1234 5678", "201012345678"),
    ("0020 112 345 6789", "201123456789"), ("123", None), (None, None),
])
def test_phone_normalization(raw, expected):
    assert normalize_egypt_phone(raw) == expected


# ── الموقع ────────────────────────────────────────────────
def test_infra_reminders_and_domain_expiry():
    def handler(request):
        soon = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
        return httpx.Response(200, json={"events": [{"eventAction": "expiration", "eventDate": soon}]})
    rep = site.Report()
    today = date(2026, 11, 10)
    subs = [{"name": "Railway", "renews_on": "2026-11-14"}, {"name": "X", "renews_on": None}]
    site.check_infra(rep, "stratix.website", subs, httpx.Client(transport=httpx.MockTransport(handler)), today)
    texts = [(f.severity, f.text) for f in rep.findings]
    assert texts[0][0] == "critical" and "الدومين" in texts[0][1]
    assert texts[1][0] == "warn" and "Railway" in texts[1][1] and len(texts) == 2


def test_audit_parsing(tmp_path):
    path = tmp_path / "audit.json"
    path.write_text(json.dumps({"metadata": {"vulnerabilities": {"high": 1, "low": 2}},
                                "advisories": {"1": {"module_name": "lodash", "severity": "high"}}}))
    rep = site.Report()
    site.check_audit(rep, path)
    assert rep.findings[0].severity == "critical" and "lodash" in rep.findings[0].text


def test_missing_security_headers_are_reported():
    def handler(request):
        if request.url.host == "stratix.website":
            return httpx.Response(200, headers={"x-content-type-options": "nosniff"})
        return httpx.Response(404)
    rep = site.Report()
    site.check_uptime(rep, "https://stratix.website", httpx.Client(transport=httpx.MockTransport(handler)))
    sec = [f for f in rep.findings if f.owner == "security"][0]
    assert sec.severity == "warn" and "HSTS" in sec.text


# ── التقرير ────────────────────────────────────────────────
def test_daily_report_uses_real_numbers():
    company = make_company(ScriptedLLM([("رئيس مجلس الإدارة 3 سطور", say("يوم كويس"))]))
    s = company.store
    now = datetime.now(timezone.utc).isoformat()
    lead = _lead(s, email="a@x.com", status="interested", created_at=now)
    s.insert("outreach_messages", {"lead_id": lead["id"], "direction": "out", "status": "sent",
                                   "channel": "email", "body": "أهلا", "sent_at": now, "created_at": now})
    s.insert("approvals", {"agent_id": "ceo", "kind": "decision", "summary": "باقة جديدة", "status": "pending"})
    row = report.write_daily(company, {"finance": "دخل 5000"}, None)
    assert "1 إيميل" in row["headline"] and "1 مستنية موافقتك" in row["headline"]
    assert "باقة جديدة" in row["body"] and "دخل 5000" in row["body"] and "يوم كويس" in row["body"]
    assert s.select("daily_reports")[0]["report_date"] == row["report_date"]


def test_ceo_meeting_follows_chairman_chat_directives():
    llm = ScriptedLLM([])
    company = make_company(llm)
    company.store.insert("chats", {"agent_id": "ceo", "role": "owner", "content": "ركزوا بكرة على العيادات"})
    company.store.insert("chats", {"agent_id": "writer", "role": "owner", "content": "خلي الرسايل أقصر"})
    meeting.run(company, {})
    opening, decision = llm.prompts[0], llm.prompts[-1]
    assert "ركزوا بكرة على العيادات" in opening and "ركزوا بكرة على العيادات" in decision
    assert any("خلي الرسايل أقصر" in p for p in llm.prompts[1:-1])  # الكاتبة شافت توجيهها


def test_ceo_feedback_reaches_the_employee():
    llm = ScriptedLLM([("اقفل الاجتماع", say("القرار", feedback=[{"agent_id": "writer", "note": "الرسايل طويلة، قصّريها"}]))])
    company = make_company(llm)
    meeting.run(company, {})
    task = company.store.select("tasks", agent_id="writer")[0]
    assert "قصّريها" in task["title"] and task["status"] == "todo"
    # الاجتماع الجاي: الكاتبة بتشوف الملاحظة في مهامها المفتوحة
    meeting.run(company, {})
    assert any("قصّريها" in p and "مهامك المفتوحة" in p for p in llm.prompts)
