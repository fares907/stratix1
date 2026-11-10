"""خط المبيعات: تأهيل ← كتابة ← إرسال ← متابعة، وصندوق الوارد.

قنوات التواصل:
  - email: بيتبعت أوتوماتيك من Gmail في حدود العدد اليومي.
  - whatsapp: المحلات اللي معاها رقم بس. الرسالة بتتكتب وتتحفظ "جاهزة"،
    واللوحة بتعرضها بزرار بيفتح واتساب بالرسالة (إرسال أوتوماتيك من غير
    WhatsApp Business API بيعرّض رقمك للحظر).

أي رسالة الفلتر يمسكها (سعر برّا الحدود، ميعاد، خصم) بتروح للموافقات بدل الإرسال.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .guard import check_message
from .mailer import Mailer, normalize_egypt_phone
from .router import AllModelsUnavailable
from .runtime import Company

FOLLOW_UP_AFTER_DAYS = 4
MAX_FOLLOW_UPS = 1

# أنواع الأماكن اللي غالبًا بتستفيد من موقع أكتر (ترتيب الأولوية)
_PRIORITY = {
    "restaurant": 5, "cafe": 4, "fast_food": 4, "clinic": 5, "dentist": 5, "doctors": 5,
    "pharmacy": 3,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(ts: str | None) -> datetime | None:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")) if ts else None


def suppressed(company: Company) -> set[str]:
    return {row["contact"] for row in company.store.select("suppression_list")}


def contact_key(lead: dict) -> str | None:
    if lead.get("email"):
        return lead["email"].strip().lower()
    return normalize_egypt_phone(lead.get("phone"))


# ── التأهيل (كود بس، مفيش موديل) ────────────────────────────
def qualify(company: Company) -> int:
    agent = company.agent("qualifier")
    if agent is None:
        return 0
    agent.ensure_can_work()
    agent.require("update_leads")
    blocked = suppressed(company)
    count = 0
    for lead in company.store.select("leads", status="new"):
        key = contact_key(lead)
        if not key:
            company.store.update("leads", {"status": "rejected", "notes": "مفيش إيميل ولا رقم مصري سليم"}, id=lead["id"])
            continue
        if key in blocked:
            company.store.update("leads", {"status": "unsubscribed"}, id=lead["id"])
            continue
        category = (lead.get("category") or "").removeprefix("shop:")
        priority = _PRIORITY.get(category, 2) + (1 if lead.get("email") else 0)
        company.store.update("leads", {"status": "qualified", "priority": priority}, id=lead["id"])
        count += 1
    if count:
        agent.log(f"أهّلت {count} محل جديد ورتبتهم حسب الأولوية.")
    return count


# ── الكتابة والإرسال ────────────────────────────────────────
def _write(company: Company, writer, lead: dict, *, follow_up: bool) -> str | None:
    pricing = company.rule("pricing", default={})
    kind = "رسالة متابعة قصيرة (هو مردّش على الأولى)" if follow_up else "أول رسالة"
    prompt = (
        f"اكتب {kind} بالعامية المصرية المحترمة لـ \"{lead['name']}\" "
        f"({lead.get('category')}) في {lead.get('city')}.\n"
        "المعلومة الوحيدة اللي نعرفها: المكان ده مالوش موقع على الإنترنت (حسب الخريطة).\n"
        "اشرح باختصار إزاي موقع بسيط يجيبله زباين أكتر، واعرض نعمله موقع، واطلب منه يرد لو مهتم.\n"
        f"لو هتذكر سعر، قول بس إن الأسعار بتبدأ من {pricing.get('min')} جنيه.\n"
        "ممنوع: مواعيد تسليم، خصومات، أرقام أو أعمال سابقة متألفة، أو أي وعد.\n"
        "الرسالة 5 سطور بالكتير، بأسلوب طبيعي زي ما حد من الفريق بيكتب بإيده: ابدأ بتحية باسم المكان،"
        " جمل قصيرة، من غير مبالغة أو كلام إعلانات محفوظ، واختم بسؤال واحد بسيط."
        " ماتدّعيش إنك شخص باسم معين؛ الإمضاء هيبقى \"فريق STRATIX\". حط الرسالة بس في \"say\"."
    )
    try:
        reply = writer.think(prompt)
    except AllModelsUnavailable as exc:
        writer.log(f"ماقدرتش أكتب لـ {lead['name']}: {exc}", kind="error")
        return None
    body = reply["say"].strip()
    if not body or reply["confidence"] == "low":
        return None
    return body


def outreach(company: Company, mailer: Mailer | None) -> dict[str, int]:
    writer, sender = company.agent("writer"), company.agent("outreach")
    stats = {"sent": 0, "whatsapp_ready": 0, "held": 0, "skipped": 0}
    if writer is None or sender is None:
        return stats
    writer.require("draft_message")
    sender.ensure_can_work()
    sender.require("send_message")

    rules = company.rule("outreach", default={})
    limit = int(rules.get("daily_limit", 15))
    footer = rules.get("unsubscribe_text", "")
    pricing = company.rule("pricing", default={})
    store = company.store
    blocked = suppressed(company)

    today = _now().date().isoformat()
    sent_today = sum(
        1 for m in store.select("outreach_messages", direction="out")
        if (m.get("sent_at") or "").startswith(today) or (m.get("created_at") or "").startswith(today)
    )
    budget = max(0, limit - sent_today)

    queue = sorted(store.select("leads", status="qualified"), key=lambda l: -(l.get("priority") or 0))
    queue += _due_follow_ups(company)

    for lead in queue:
        if budget <= 0:
            break
        key = contact_key(lead)
        if not key or key in blocked:
            stats["skipped"] += 1
            continue
        if lead.get("email") is None and normalize_egypt_phone(lead.get("phone")) is None:
            stats["skipped"] += 1
            continue
        if lead.get("email") and mailer is None:
            stats["skipped"] += 1  # Gmail مش متظبط لسه
            continue
        follow_up = lead.get("status") == "contacted"
        body = _write(company, writer, lead, follow_up=follow_up)
        if body is None:
            stats["skipped"] += 1
            continue
        body = f"{body}\n\nفريق STRATIX — {company.rule('company', 'website', default='')}\n{footer}"
        channel = "email" if lead.get("email") else "whatsapp"
        verdict = check_message(body, price_min=int(pricing["min"]), price_max=int(pricing["max"]))
        budget -= 1

        if not verdict.ok:
            msg = store.insert("outreach_messages", {
                "lead_id": lead["id"], "agent_id": "writer", "channel": channel,
                "direction": "out", "body": body, "status": "held",
            })
            store.insert("approvals", {
                "agent_id": "outreach", "kind": "message",
                "summary": f"رسالة لـ {lead['name']} فيها حاجة محتاجة موافقتك",
                "payload": {"outreach_id": msg["id"], "lead_id": lead["id"], "channel": channel,
                            "to": lead.get("email") or key, "body": body},
                "reasons": list(verdict.reasons),
            })
            stats["held"] += 1
            continue

        if channel == "email" and mailer is not None:
            subject = "موقع لـ " + lead["name"] if not follow_up else "بخصوص موقع " + lead["name"]
            try:
                mailer.send(lead["email"], subject, body)
            except Exception as exc:  # noqa: BLE001 — أي خطأ SMTP يتسجل ونكمّل
                store.insert("outreach_messages", {
                    "lead_id": lead["id"], "agent_id": "outreach", "channel": "email",
                    "direction": "out", "subject": subject, "body": body, "status": "failed",
                })
                sender.log(f"الإيميل لـ {lead['name']} فشل: {type(exc).__name__}", kind="error")
                continue
            store.insert("outreach_messages", {
                "lead_id": lead["id"], "agent_id": "outreach", "channel": "email", "direction": "out",
                "subject": subject, "body": body, "status": "sent", "sent_at": _now().isoformat(),
            })
            stats["sent"] += 1
        else:
            # واتساب: الرسالة جاهزة في اللوحة بزرار
            store.insert("outreach_messages", {
                "lead_id": lead["id"], "agent_id": "outreach", "channel": "whatsapp",
                "direction": "out", "body": body, "status": "draft",
            })
            stats["whatsapp_ready"] += 1
        store.update("leads", {"status": "contacted", "updated_at": _now().isoformat()}, id=lead["id"])

    sender.log(
        f"بعت {stats['sent']} إيميل، وجهزت {stats['whatsapp_ready']} رسالة واتساب، "
        f"و{stats['held']} مستنية موافقة. باقي من حد النهارده: {budget}."
    )
    return stats


def _due_follow_ups(company: Company) -> list[dict]:
    """المحلات اللي اتبعتلها ومردّتش بعد FOLLOW_UP_AFTER_DAYS، ولسه ماتابعناش معاها."""
    due = []
    cutoff = _now() - timedelta(days=FOLLOW_UP_AFTER_DAYS)
    for lead in company.store.select("leads", status="contacted"):
        thread = company.store.select("outreach_messages", lead_id=lead["id"])
        outs = [m for m in thread if m["direction"] == "out" and m["status"] == "sent"]
        if any(m["direction"] == "in" for m in thread) or not outs or len(outs) > MAX_FOLLOW_UPS:
            continue
        last = max(_parse(m.get("sent_at") or m.get("created_at")) for m in outs)
        if last and last < cutoff:
            due.append(lead)
    return due


# ── الوارد وخدمة العملاء ───────────────────────────────────
UNSUBSCRIBE_WORDS = ("إلغاء", "الغاء", "unsubscribe", "stop", "مش عايز")


def inbox(company: Company, mailer: Mailer) -> dict[str, int]:
    support = company.agent("support")
    stats = {"replies": 0, "unsubscribed": 0, "answered": 0, "held": 0}
    if support is None:
        return stats
    support.ensure_can_work()
    support.require("read_inbox")
    store = company.store
    pricing = company.rule("pricing", default={})
    leads_by_email = {(l.get("email") or "").lower(): l for l in store.select("leads") if l.get("email")}

    for mail in mailer.unread():
        lead = leads_by_email.get(mail.sender)
        if lead is None:
            continue  # مش رد على حاجة بعتناها — مابنلمسش باقي الإيميلات
        stats["replies"] += 1
        store.insert("outreach_messages", {
            "lead_id": lead["id"], "agent_id": "support", "channel": "email", "direction": "in",
            "subject": mail.subject, "body": mail.body[:5000], "status": "received",
        })
        text = f"{mail.subject}\n{mail.body}".lower()
        if any(word in text for word in UNSUBSCRIBE_WORDS) and len(mail.body) < 200:
            store.upsert("suppression_list", [{"contact": mail.sender}], on_conflict="contact")
            store.update("leads", {"status": "unsubscribed"}, id=lead["id"])
            stats["unsubscribed"] += 1
            continue

        thread = store.select("outreach_messages", lead_id=lead["id"])
        history = "\n".join(f"{'إحنا' if m['direction'] == 'out' else 'العميل'}: {m['body']}" for m in thread[-6:])
        reply = support.think(
            f"العميل \"{lead['name']}\" رد على رسالتنا. المحادثة:\n{history}\n\n"
            "اكتب رد قصير بالعامية المصرية المحترمة في \"say\"، بأسلوب طبيعي ودافي زي ما موظف مبيعات شاطر"
            " بيرد على عميل: رد على كلامه هو بالظبط، جمل قصيرة، من غير كلام محفوظ أو رسمي زيادة، ومن غير"
            " قوايم ونقط. اختم بسؤال واحد يحرّك الكلام (زي: تحب نكلمك تليفون؟ أو المكان بيشتغل من إمتى؟)،"
            " وامضي \"فريق STRATIX\". ماتدّعيش إنك شخص باسم معين، ولو سأل إذا كان بيكلم بني آدم ولا برنامج"
            " قوله بصراحة إن ده مساعد فريق STRATIX وإن حد من الفريق هيتابع معاه. وزوّد في JSON:\n"
            '"asked_if_bot": true لو سأل إذا كان بيكلم بني آدم ولا برنامج\n'
            '"interest": "interested" أو "not_interested" أو "question"\n'
            '"needs_human": true لو بيسأل عن حاجة مش في القوانين (ميعاد تسليم، تفاصيل تقنية مش متأكد منها، خصم).'
        )
        status = {"interested": "interested", "not_interested": "lost"}.get(str(reply.get("interest")), "replied")
        store.update("leads", {"status": status}, id=lead["id"])
        if status == "lost":
            continue

        body = reply["say"]
        verdict = check_message(body, price_min=int(pricing["min"]), price_max=int(pricing["max"]))
        if reply.get("needs_human") or not verdict.ok or reply["confidence"] == "low":
            reasons = list(verdict.reasons) or ["خدمة العملاء مش متأكدة من الرد"]
            store.insert("approvals", {
                "agent_id": "support", "kind": "message",
                "summary": f"رد على {lead['name']} محتاج موافقتك",
                "payload": {"lead_id": lead["id"], "channel": "email", "to": mail.sender,
                            "subject": "Re: " + mail.subject, "in_reply_to": mail.message_id,
                            "body": body, "customer_said": mail.body[:2000]},
                "reasons": reasons,
            })
            stats["held"] += 1
            continue
        mailer.send(mail.sender, "Re: " + mail.subject, body, in_reply_to=mail.message_id)
        store.insert("outreach_messages", {
            "lead_id": lead["id"], "agent_id": "support", "channel": "email", "direction": "out",
            "subject": "Re: " + mail.subject, "body": body, "status": "sent", "sent_at": _now().isoformat(),
        })
        stats["answered"] += 1

    if stats["replies"]:
        support.log(
            f"وصلنا {stats['replies']} رد: رديت على {stats['answered']}، "
            f"و{stats['held']} مستنية موافقتك، و{stats['unsubscribed']} لغوا الاشتراك."
        )
    return stats


# ── تنفيذ الموافقات ────────────────────────────────────────
def execute_approved(company: Company, mailer: Mailer | None) -> int:
    """بينفّذ اللي رئيس مجلس الإدارة وافق عليه بس (status = approved)."""
    store = company.store
    done = 0
    for approval in store.select("approvals", status="approved"):
        if store.is_halted():
            break
        payload = approval.get("payload") or {}
        if approval["kind"] != "message":
            store.update("approvals", {"status": "executed"}, id=approval["id"])
            continue
        try:
            if payload.get("channel") == "email" and mailer is not None:
                mailer.send(payload["to"], payload.get("subject") or "STRATIX", payload["body"],
                            in_reply_to=payload.get("in_reply_to"))
                status = "sent"
            else:
                status = "draft"  # واتساب: بتظهر في اللوحة بزرار الإرسال
            if payload.get("outreach_id"):
                store.update("outreach_messages", {"status": status, "body": payload["body"],
                                                   "sent_at": _now().isoformat()}, id=payload["outreach_id"])
            else:
                store.insert("outreach_messages", {
                    "lead_id": payload["lead_id"], "agent_id": approval["agent_id"],
                    "channel": payload.get("channel", "email"), "direction": "out",
                    "subject": payload.get("subject"), "body": payload["body"], "status": status,
                    "sent_at": _now().isoformat(),
                })
            if payload.get("lead_id"):
                store.update("leads", {"status": "contacted"}, id=payload["lead_id"])
            store.update("approvals", {"status": "executed"}, id=approval["id"])
            done += 1
        except Exception as exc:  # noqa: BLE001
            store.update("approvals", {"status": "failed", "decision_note": f"فشل التنفيذ: {type(exc).__name__}"},
                         id=approval["id"])
    return done
