"""الأرقام اليومية (بالكود) والتقرير اليومي لرئيس مجلس الإدارة.

الأرقام كلها بتتحسب من قاعدة البيانات. المدير التنفيذي بيكتب التعليق بس،
والتقرير بيقول بوضوح إيه اللي أرقام حقيقية وإيه اللي رأي.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .router import AllModelsUnavailable
from .runtime import Company


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _is_today(row: dict, *keys: str) -> bool:
    today = _today()
    return any((row.get(k) or "").startswith(today) for k in keys)


def sales_numbers(company: Company) -> dict:
    store = company.store
    leads = store.select("leads")
    msgs = store.select("outreach_messages")
    by_status: dict[str, int] = {}
    for lead in leads:
        by_status[lead["status"]] = by_status.get(lead["status"], 0) + 1
    return {
        "leads_total": len(leads),
        "leads_new_today": sum(1 for l in leads if _is_today(l, "created_at")),
        "leads_by_status": by_status,
        "emails_sent_today": sum(1 for m in msgs if m["direction"] == "out" and m["status"] == "sent" and _is_today(m, "sent_at")),
        "whatsapp_ready": sum(1 for m in msgs if m["channel"] == "whatsapp" and m["status"] == "draft"),
        "replies_today": sum(1 for m in msgs if m["direction"] == "in" and _is_today(m, "created_at")),
        "held_for_approval": sum(1 for m in msgs if m["status"] == "held"),
    }


def build_facts(company: Company, extra: dict[str, str]) -> dict[str, str]:
    """الحقائق اللي كل موظف بيعرضها في الاجتماع (بالكود)."""
    n = sales_numbers(company)
    s = n["leads_by_status"]
    facts = {
        "scout": f"عندنا {n['leads_total']} محل في القائمة، منهم {n['leads_new_today']} اتضافوا النهارده.",
        "qualifier": f"مؤهَّلين ومستنيين رسالة: {s.get('qualified', 0)}. مستبعدين: {s.get('rejected', 0)}.",
        "writer": f"رسايل مستنية موافقة بسبب الفلتر: {n['held_for_approval']}.",
        "outreach": (f"إيميلات اتبعتت النهارده: {n['emails_sent_today']}. رسايل واتساب جاهزة مستنية تتبعت: "
                     f"{n['whatsapp_ready']}. اتكلّمنا معاهم ومستنيين رد: {s.get('contacted', 0)}."),
        "support": (f"ردود وصلت النهارده: {n['replies_today']}. مهتمين: {s.get('interested', 0)}. "
                    f"لغوا الاشتراك: {s.get('unsubscribed', 0)}."),
        "_company": (f"محلات في القائمة {n['leads_total']}، إيميلات النهارده {n['emails_sent_today']}، "
                     f"ردود {n['replies_today']}، مهتمين {s.get('interested', 0)}."),
    }
    facts.update({k: v for k, v in extra.items() if v})
    return facts


def write_daily(company: Company, facts: dict[str, str], meeting_id: int | None) -> dict:
    store = company.store
    n = sales_numbers(company)
    pending = store.select("approvals", status="pending")
    meeting = store.select("meetings", id=meeting_id)[0] if meeting_id else None
    checks = [c for c in store.select("site_checks") if _is_today(c, "created_at")]
    problems = [d["text"] for c in checks for d in (c.get("details") or []) if d.get("severity") != "ok"]

    sent_today = [m for m in store.select("outreach_messages") if _is_today(m, "sent_at", "created_at")]
    leads = {l["id"]: l["name"] for l in store.select("leads")}

    lines = [
        f"# تقرير يوم {_today()}",
        "",
        "## الأرقام (من قاعدة البيانات)",
        f"- محلات جديدة النهارده: {n['leads_new_today']} (الإجمالي {n['leads_total']})",
        f"- إيميلات اتبعتت: {n['emails_sent_today']}",
        f"- رسايل واتساب جاهزة ليك تبعتها: {n['whatsapp_ready']}",
        f"- ردود العملاء: {n['replies_today']}",
        f"- مهتمين: {n['leads_by_status'].get('interested', 0)}",
        "",
        "## الرسايل والردود",
    ]
    if sent_today:
        for m in sent_today[:30]:
            who = leads.get(m["lead_id"], "؟")
            arrow = "← رد من" if m["direction"] == "in" else "→ لـ"
            lines.append(f"- {arrow} {who} ({m['channel']}, {m['status']}): {m['body'][:140].replace(chr(10), ' ')}")
    else:
        lines.append("- مفيش رسايل النهارده.")

    lines += ["", "## الموقع والأمان"]
    lines += [f"- ⚠️ {p}" for p in problems] or ["- كل الفحوصات سليمة."]
    for key, label in (("finance", "المالية"), ("projects", "المشاريع"), ("analytics", "الزوار")):
        if facts.get(key):
            lines += ["", f"## {label}", facts[key]]

    lines += ["", f"## محتاج موافقتك ({len(pending)})"]
    lines += [f"- {a['summary']}" for a in pending] or ["- مفيش."]

    if meeting and meeting.get("summary"):
        lines += ["", "## قرار الاجتماع", meeting["summary"]]

    tasks = [t for t in store.select("tasks") if meeting_id and t.get("meeting_id") == meeting_id]
    if tasks:
        lines += ["", "## المهام اللي اتوزعت"]
        lines += [f"- {t['agent_id']}: {t['title']}" for t in tasks]

    ceo = company.agent("ceo")
    if ceo:
        try:
            note = ceo.think(
                "اكتب لرئيس مجلس الإدارة 3 سطور: أهم حاجة حصلت النهارده، وأكبر مشكلة، وإيه اللي محتاجه منه."
                " استخدم الأرقام دي بس ومتزودش عليها:\n" + "\n".join(lines)
            )
            lines += ["", "## رأي المدير التنفيذي (رأي، مش أرقام)", note["say"]]
            if note["unknowns"]:
                lines.append("مش متأكد من: " + "، ".join(note["unknowns"]))
        except AllModelsUnavailable:
            lines += ["", "_المدير التنفيذي ماقدرش يكتب تعليق النهارده (الموديلات مش متاحة)._"]

    headline = (f"STRATIX {_today()}: {n['emails_sent_today']} إيميل، {n['replies_today']} رد، "
                f"{n['leads_by_status'].get('interested', 0)} مهتم، {len(pending)} مستنية موافقتك"
                + (f"، ⚠️ {len(problems)} مشكلة في الموقع" if problems else ""))
    row = {"report_date": _today(), "headline": headline, "body": "\n".join(lines),
           "numbers": n, "meeting_id": meeting_id}
    store.upsert("daily_reports", [row], on_conflict="report_date")
    return row
