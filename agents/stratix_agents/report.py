"""الأرقام اليومية (بالكود) والتقرير اليومي لرئيس مجلس الإدارة.

الأرقام كلها بتتحسب من قاعدة البيانات. المدير التنفيذي بيكتب التعليق بس،
والتقرير بيقول بوضوح إيه اللي أرقام حقيقية وإيه اللي رأي.
"""

from __future__ import annotations

import re
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


AR_STATUS = {"ok": "سليم", "warn": "يحتاج متابعة", "critical": "عاجل"}
AREA = {"uptime": "تشغيل الموقع", "security": "الأمان", "infra": "البنية والاشتراكات"}


def _numbers_in(text: str) -> set[str]:
    return set(re.findall(r"\d+(?:[.,]\d+)?", text or ""))


def _honest(text: str, source: str) -> bool:
    """أي رقم في كلام المدير لازم يكون موجود في البيانات الحقيقية، غير كده الفقرة بتترفض."""
    allowed = _numbers_in(source) | {str(i) for i in range(11)}
    return _numbers_in(text) <= allowed


def _editorial(company: Company, source: str) -> dict:
    """المدير التنفيذي بيكتب الملخص والتحليل بالفصحى من الأرقام الحقيقية بس."""
    ceo = company.agent("ceo")
    if not ceo:
        return {}
    try:
        note = ceo.think(
            "أنت تكتب التقرير اليومي الرسمي لشركة STRATIX موجّهًا إلى رئيسَي مجلس الإدارة."
            " اكتب باللغة العربية الفصحى وبأسلوب تقارير الشركات المهني، دون أي عامية، ودون رموز أو إيموجي."
            " لا تذكر أي رقم غير موجود حرفيًا في البيانات أدناه، ولا تختلق أحداثًا.\n\n"
            f"البيانات الحقيقية لليوم:\n{source}\n\n"
            'أجب بـ JSON يحتوي: "say" = ملخص تنفيذي في فقرة واحدة (3-4 جمل)،'
            ' "highlights" = قائمة بأهم 3 إنجازات أو وقائع، "risks" = قائمة بالمخاطر أو المشكلات (قد تكون فارغة)،'
            ' "recommendations" = قائمة بـ 2-4 توصيات عملية لرئيس مجلس الإدارة،'
            ' "finance" = فقرة تحليلية عن الوضع المالي إن وُجدت بيانات مالية،'
            ' "ideas" = قائمة بنفس ترتيب الأفكار المعروضة، كل عنصر صياغة فصحى موجزة للفكرة (جملة واحدة).'
        )
    except AllModelsUnavailable:
        return {}

    def clean(value, limit=6):
        items = value if isinstance(value, list) else []
        return [str(x).strip() for x in items if str(x).strip() and _honest(str(x), source)][:limit]

    out = {
        "summary": note["say"] if _honest(note["say"], source) else "",
        "highlights": clean(note.get("highlights")),
        "risks": clean(note.get("risks")),
        "recommendations": clean(note.get("recommendations")),
        "finance": str(note.get("finance") or "") if _honest(str(note.get("finance") or ""), source) else "",
        "ideas": [str(x).strip() for x in (note.get("ideas") or []) if isinstance(note.get("ideas"), list)],
    }
    return out


def write_daily(company: Company, facts: dict[str, str], meeting_id: int | None) -> dict:
    """التقرير اليومي: الأرقام من قاعدة البيانات بالكود، والتحليل بالفصحى من المدير التنفيذي.
    بيتحفظ منظّم (data) عشان اللوحة تعرضه كمستند رسمي وتنزّله PDF، ومعاه نسخة نصية (body)."""
    store = company.store
    n = sales_numbers(company)
    s = n["leads_by_status"]
    specs = company.config.agents
    names = {k: v.name for k, v in specs.items()} | {a["id"]: a.get("name") or a["id"] for a in store.select("agents")}
    titles = {k: v.title for k, v in specs.items()} | {a["id"]: a.get("title") or "" for a in store.select("agents")}
    pending = store.select("approvals", status="pending")
    meeting = store.select("meetings", id=meeting_id)[0] if meeting_id else None
    today_meetings = [m for m in store.select("meetings") if _is_today(m, "started_at") and m.get("status") == "done"]

    # فحوصات الموقع: آخر نتيجة لكل بند النهارده
    checks: dict[str, dict] = {}
    for c in sorted((c for c in store.select("site_checks") if _is_today(c, "created_at")), key=lambda c: c.get("created_at") or ""):
        for d in c.get("details") or []:
            checks[d.get("owner", "") + ":" + _topic(d.get("text", ""))] = d
    site = [{"area": AREA.get(d.get("owner"), d.get("owner")), "status": d.get("severity", "ok"),
             "status_label": AR_STATUS.get(d.get("severity", "ok"), ""), "text": d.get("text", "")}
            for d in checks.values()]
    site.sort(key=lambda x: {"critical": 0, "warn": 1, "ok": 2}.get(x["status"], 3))
    problems = [c for c in site if c["status"] != "ok"]

    proposals = [p for p in store.select("proposals") if any(p.get("meeting_id") == m["id"] for m in today_meetings)]
    finished = [t for t in store.select("tasks") if t.get("status") == "done" and t.get("result")
                and (t.get("completed_at") or "").startswith(_today())]
    assigned = [t for t in store.select("tasks") if t.get("status") in ("todo", "doing")]

    kpis = [
        {"label": "عملاء محتملون جدد", "value": n["leads_new_today"], "hint": f"الإجمالي {n['leads_total']}"},
        {"label": "تواصل مع عملاء", "value": s.get("contacted", 0), "hint": f"رسائل جاهزة {n['whatsapp_ready']}"},
        {"label": "ردود العملاء", "value": n["replies_today"], "hint": f"مهتمون {s.get('interested', 0)}"},
        {"label": "بانتظار موافقتك", "value": len(pending), "hint": "قرارات معلّقة"},
        {"label": "حالة الموقع", "value": "سليم" if not problems else f"{len(problems)} ملاحظة",
         "hint": "تشغيل وأمان واشتراكات", "tone": "ok" if not problems else "warn"},
        {"label": "مهام مُنجزة اليوم", "value": len(finished), "hint": f"مفتوحة {len(assigned)}"},
    ]

    source_lines = [
        f"عملاء محتملون جدد اليوم: {n['leads_new_today']} من إجمالي {n['leads_total']}.",
        f"تم التواصل مع: {s.get('contacted', 0)}. رسائل واتساب جاهزة: {n['whatsapp_ready']}. رسائل بريد أُرسلت اليوم: {n['emails_sent_today']}.",
        f"ردود العملاء اليوم: {n['replies_today']}. مهتمون: {s.get('interested', 0)}.",
        f"قرارات بانتظار موافقة رئيس مجلس الإدارة: {len(pending)}.",
        "فحوصات الموقع: " + "؛ ".join(f"{c['area']}: {c['text']}" for c in site),
        f"البيانات المالية: {facts.get('finance', 'غير متاحة')}",
        f"الحجوزات والمشروعات: {facts.get('projects', 'غير متاحة')}",
        f"الزوار: {facts.get('analytics', 'غير متاحة')}",
        "ملخص اجتماعات اليوم: " + " | ".join(m.get("summary") or "" for m in today_meetings),
        "الأفكار المعروضة بالترتيب: " + " | ".join(f"{i + 1}) {p['idea']} ({p['status']})" for i, p in enumerate(proposals[:12])),
        "مهام أُنجزت اليوم: " + " | ".join(t["title"] for t in finished),
    ]
    source = "\n".join(source_lines)
    ed = _editorial(company, source)
    ideas_formal = ed.get("ideas") or []

    def idea_text(i: int, p: dict) -> str:
        return ideas_formal[i] if i < len(ideas_formal) and ideas_formal[i] else p["idea"]

    data = {
        "version": 2,
        "date": _today(),
        "summary": ed.get("summary") or (
            f"سُجّل اليوم {n['leads_new_today']} عميلًا محتملًا جديدًا، وتم التواصل مع {s.get('contacted', 0)}، "
            f"ووردت {n['replies_today']} ردود، ويوجد {len(pending)} قرارًا بانتظار موافقتكم."),
        "kpis": kpis,
        "highlights": ed.get("highlights") or [],
        "risks": ed.get("risks") or [p["text"] for p in problems],
        "recommendations": ed.get("recommendations") or [],
        "finance": ed.get("finance") or "",
        "finance_raw": facts.get("finance") or "",
        "sales": {
            "rows": [
                ["إجمالي العملاء المحتملين", n["leads_total"]], ["أُضيفوا اليوم", n["leads_new_today"]],
                ["مؤهَّلون بانتظار التواصل", s.get("qualified", 0)], ["تم التواصل معهم", s.get("contacted", 0)],
                ["رسائل واتساب جاهزة للإرسال", n["whatsapp_ready"]], ["رسائل بريد أُرسلت اليوم", n["emails_sent_today"]],
                ["ردود اليوم", n["replies_today"]], ["مهتمون", s.get("interested", 0)],
            ],
        },
        "site": site,
        "ideas": [
            {"who": names.get(p["agent_id"], p["agent_id"]), "idea": idea_text(i, p), "status": p["status"],
             "reason": p.get("ceo_reason") or ""}
            for i, p in enumerate(proposals[:12])
        ],
        "meeting_summary": (meeting or {}).get("summary") or (today_meetings[-1].get("summary") if today_meetings else ""),
        "tasks_done": [{"who": names.get(t["agent_id"], t["agent_id"]), "role": titles.get(t["agent_id"], ""),
                        "title": t["title"], "result": t["result"][:2500]} for t in finished],
        "tasks_open": [{"who": names.get(t["agent_id"], t["agent_id"]), "title": t["title"]} for t in assigned[:20]],
        "approvals": [a["summary"] for a in pending],
    }

    lines = [f"# التقرير اليومي لشركة STRATIX — {_today()}", "", "## الملخص التنفيذي", data["summary"], "",
             "## المؤشرات الرئيسية"]
    lines += [f"- {k['label']}: {k['value']} ({k['hint']})" for k in kpis]
    for title, items in (("أبرز ما تم", data["highlights"]), ("المخاطر والملاحظات", data["risks"]),
                         ("التوصيات", data["recommendations"])):
        if items:
            lines += ["", f"## {title}"] + [f"- {x}" for x in items]
    lines += ["", "## الموقع والأمان"] + [f"- {c['area']} ({c['status_label']}): {c['text']}" for c in site]
    if data["finance"] or data["finance_raw"]:
        lines += ["", "## الوضع المالي", data["finance"] or data["finance_raw"]]
    if data["ideas"]:
        lines += ["", "## قرارات الاجتماع"] + [
            f"- {i['who']}: {i['idea']} — {'معتمدة' if i['status'] == 'approved' else 'مرفوضة' if i['status'] == 'rejected' else 'قيد الدراسة'}"
            for i in data["ideas"]]
    if data["tasks_done"]:
        lines += ["", "## المهام المنجزة"]
        for t in data["tasks_done"]:
            lines += [f"### {t['who']}: {t['title']}", t["result"]]
    lines += ["", f"## بانتظار موافقتكم ({len(pending)})"] + ([f"- {a}" for a in data["approvals"]] or ["- لا يوجد."])

    headline = (f"تقرير STRATIX {_today()}: {n['leads_new_today']} عميل جديد، {n['replies_today']} رد، "
                f"{len(pending)} بانتظار موافقتك" + (f"، {len(problems)} ملاحظة على الموقع" if problems else ""))
    row = {"report_date": _today(), "headline": headline, "body": "\n".join(lines),
           "numbers": n, "meeting_id": meeting_id, "data": data}
    store.upsert("daily_reports", [row], on_conflict="report_date")
    return row


def _topic(text: str) -> str:
    """بند الفحص من غير الأرقام (عشان آخر نتيجة لنفس البند تحل محل اللي قبلها)."""
    return re.sub(r"\d+", "#", text)[:40]
