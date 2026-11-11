"""قراية قاعدة بيانات الموقع (TiDB/MySQL) للمالية ومدير المشاريع ومحللة الزوار.

بيستخدم SITE_DATABASE_URL لمستخدم **قراية بس**. اعمله من TiDB كده:
  CREATE USER 'agents_ro'@'%' IDENTIFIED BY '<باسورد قوي>';
  GRANT SELECT ON <اسم القاعدة>.* TO 'agents_ro'@'%';
وكمان كل الاستعلامات هنا SELECT بس، والاتصال بيتفتح read-only.

الأرقام كلها بيحسبها الكود؛ الموديل بيعلّق عليها بس ومابيألّفهاش.
"""

from __future__ import annotations

import ssl
import time
from urllib.parse import unquote, urlparse

DAY_MS = 86_400_000


def connect(url: str):
    import pymysql  # بيتحمّل بس لو فيه قاعدة بيانات للموقع

    u = urlparse(url)
    conn = pymysql.connect(
        host=u.hostname,
        port=u.port or 4000,
        user=unquote(u.username or ""),
        password=unquote(u.password or ""),
        database=u.path.lstrip("/"),
        ssl=ssl.create_default_context(),
        connect_timeout=20,
        read_timeout=60,
        cursorclass=pymysql.cursors.DictCursor,
        charset="utf8mb4",
    )
    with conn.cursor() as cur:
        cur.execute("SET SESSION TRANSACTION READ ONLY")
    return conn


def _rows(conn, sql: str, args: tuple = ()) -> list[dict]:
    assert sql.lstrip().upper().startswith("SELECT"), "قراية بس"
    with conn.cursor() as cur:
        cur.execute(sql, args)
        return list(cur.fetchall())


def _money(rows: list[dict], key: str = "total") -> str:
    parts = [f"{float(r[key] or 0):,.0f} {r.get('currency') or 'EGP'}" for r in rows if r[key]]
    return " + ".join(parts) or "0"


def finance_facts(conn, now_ms: int | None = None) -> str:
    now_ms = now_ms or int(time.time() * 1000)
    month_ago = now_ms - 30 * DAY_MS
    ledger = _rows(conn, "SELECT type, SUM(amount) AS total, COUNT(*) AS n FROM ledgerEntries "
                         "WHERE occurredAt >= %s GROUP BY type", (month_ago,))
    by_type = {r["type"]: float(r["total"] or 0) for r in ledger}
    costs = _rows(conn, "SELECT currency, category, SUM(amount) AS total FROM invoices "
                        "WHERE occurredAt >= %s GROUP BY currency, category", (month_ago,))
    unpaid = _rows(conn, "SELECT currency, SUM(amountDue) AS total, COUNT(*) AS n FROM bookings "
                         "WHERE paymentStatus = 'unpaid' AND amountDue IS NOT NULL GROUP BY currency")
    review = _rows(conn, "SELECT COUNT(*) AS n FROM bookings WHERE paymentStatus = 'awaiting_review'")
    paid = _rows(conn, "SELECT currency, SUM(amountDue) AS total FROM bookings "
                       "WHERE paymentStatus = 'paid' AND paidAt >= %s GROUP BY currency", (month_ago,))
    income, expense = by_type.get("income", 0.0), by_type.get("expense", 0.0)
    return (
        f"آخر 30 يوم (من دفتر الحسابات): دخل {income:,.0f} ج، مصاريف {expense:,.0f} ج، "
        f"صافي {income - expense:,.0f} ج.\n"
        f"فواتير الاشتراكات (دومين/استضافة/أدوات) آخر 30 يوم: "
        f"{'، '.join(f'{c['category']}: {float(c['total']):,.0f} {c['currency']}' for c in costs) or 'مفيش'}.\n"
        f"اتدفع من العملاء آخر 30 يوم: {_money(paid)}.\n"
        f"فلوس لسه ماتحصّلتش: {_money(unpaid)} على {sum(r['n'] for r in unpaid)} حجز.\n"
        f"تحويلات مستنية مراجعة: {review[0]['n'] if review else 0}."
    )


def projects_facts(conn, now_ms: int | None = None) -> str:
    now_ms = now_ms or int(time.time() * 1000)
    stages = _rows(conn, "SELECT stage, COUNT(*) AS n FROM bookings WHERE status <> 'closed' GROUP BY stage")
    stale = _rows(conn, "SELECT publicId, name, stage, stageUpdatedAt FROM bookings "
                        "WHERE status <> 'closed' AND stage NOT IN ('delivered') "
                        "AND COALESCE(stageUpdatedAt, createdAt) < %s ORDER BY stageUpdatedAt LIMIT 10",
                  (now_ms - 7 * DAY_MS,))
    untouched = _rows(conn, "SELECT COUNT(*) AS n FROM bookings WHERE status = 'new' AND createdAt < %s",
                      (now_ms - DAY_MS,))
    contacts = _rows(conn, "SELECT COUNT(*) AS n FROM contactLeads WHERE status = 'new' AND createdAt < %s",
                     (now_ms - DAY_MS,))
    names = {"received": "استلام", "design": "تصميم", "development": "برمجة", "review": "مراجعة", "delivered": "اتسلّم"}
    return (
        "المشاريع المفتوحة حسب المرحلة: "
        + ("، ".join(f"{names.get(r['stage'], r['stage'])}: {r['n']}" for r in stages) or "مفيش")
        + f".\nمشاريع مااتحرّكتش من أسبوع: {len(stale)}"
        + (" (" + "، ".join(f"{r['name']} في {names.get(r['stage'], r['stage'])}" for r in stale) + ")" if stale else "")
        + f".\nحجوزات جديدة محدّش كلّمها من أكتر من يوم: {untouched[0]['n'] if untouched else 0}."
        + f"\nطلبات تواصل جديدة من أكتر من يوم: {contacts[0]['n'] if contacts else 0}."
    )


def analytics_facts(conn, now_ms: int | None = None) -> str:
    now_ms = now_ms or int(time.time() * 1000)
    week = now_ms - 7 * DAY_MS
    bookings = _rows(conn, "SELECT projectType, COUNT(*) AS n FROM bookings WHERE createdAt >= %s GROUP BY projectType", (week,))
    contacts = _rows(conn, "SELECT topic, COUNT(*) AS n FROM contactLeads WHERE createdAt >= %s GROUP BY topic", (week,))
    prev = _rows(conn, "SELECT COUNT(*) AS n FROM bookings WHERE createdAt >= %s AND createdAt < %s",
                 (week - 7 * DAY_MS, week))
    total = sum(r["n"] for r in bookings)
    return (
        f"حجوزات آخر 7 أيام: {total} (الأسبوع اللي قبله: {prev[0]['n'] if prev else 0}) — "
        + ("، ".join(f"{r['projectType']}: {r['n']}" for r in bookings) or "مفيش")
        + f".\nطلبات تواصل آخر 7 أيام: {sum(r['n'] for r in contacts)}."
        + "\nملحوظة: الموقع مابيسجّلش عدد الزوار، فمعدل التحويل مش معروف."
    )


# ── من غير SITE_DATABASE_URL: أرقام الموقع من /api/agents/facts (بتوكن GitHub OIDC) ──
SITE_FACTS_URL = "https://stratix.website/api/agents/facts"


def _egp(value) -> str:
    return f"{float(value or 0):,.0f} جنيه"


# أقسام بيانات الموقع، وكل قسم ليه صلاحية لازم تكون عند الموظف عشان يشوفه
SECTION_TOOLS = {
    "finance": "view_finance",    # دفتر الحسابات والفواتير والتحصيل
    "bookings": "view_bookings",  # الحجوزات ومراحل المشاريع
    "contacts": "view_contacts",  # طلبات التواصل من الشات والموقع
    "stats": "view_stats",        # إحصائيات إجمالية بس
}

_STAGE = {"received": "استلام", "design": "تصميم", "development": "برمجة", "review": "مراجعة", "delivered": "اتسلّم"}
_PAY = {"paid": "مدفوع", "unpaid": "مش مدفوع", "awaiting_review": "تحويل مستني مراجعة"}
_STATUS = {"new": "جديد", "contacted": "اتكلمنا معاه", "closed": "مقفول"}
_TOPIC = {"new_site": "عايز موقع جديد", "existing_issue": "مشكلة في موقع", "other": "حاجة تانية"}


def _date(ms) -> str:
    from datetime import datetime, timezone
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return "؟"


def site_sections(data: dict) -> dict[str, str]:
    """بيحوّل بيانات الموقع لأقسام نصية (الأرقام زي ما هي)، قسم لكل صلاحية."""
    ledger = data.get("ledger") or {}
    month, year = ledger.get("thisMonth") or {}, ledger.get("thisYear") or {}
    inv = data.get("invoices") or {}
    book = data.get("bookings") or {}
    contacts = data.get("contacts") or {}
    pay = book.get("byPaymentStatus") or {}
    status = book.get("byStatus") or {}

    finance = (
        f"دفتر حسابات الشركة (من الموقع): الشهر ده دخل {_egp(month.get('income'))}، مصاريف {_egp(month.get('expense'))}، "
        f"صافي {_egp(month.get('net'))}. السنة دي: دخل {_egp(year.get('income'))}، مصاريف {_egp(year.get('expense'))}، "
        f"صافي {_egp(year.get('net'))}.\n"
        f"فواتير الاشتراكات السنة دي: {float(inv.get('egpThisYear') or 0):,.0f} جنيه و{float(inv.get('usdThisYear') or 0):,.2f} دولار"
        f" ({inv.get('total', 0)} فاتورة في الإجمالي).\n"
        f"الحجوزات حسب الدفع: مدفوع {pay.get('paid', 0)}، مستني مراجعة تحويل {pay.get('awaiting_review', 0)}، لسه مادفعش {pay.get('unpaid', 0)}."
    )
    unpaid = [b for b in data.get("recentBookings") or [] if b.get("paymentStatus") != "paid" and b.get("amountDue")]
    if unpaid:
        finance += "\nفلوس لسه ماتحصّلتش (آخر الحجوزات): " + "، ".join(
            f"{b.get('publicId')} ({float(b['amountDue']):,.0f} {b.get('currency', 'EGP')}، {_PAY.get(b.get('paymentStatus'), '؟')})"
            for b in unpaid[:10])

    recent = data.get("recentBookings") or []
    bookings = (
        f"الحجوزات: إجمالي {book.get('total', 0)} — جديد {status.get('new', 0)}، اتكلمنا معاه {status.get('contacted', 0)}، "
        f"مقفول {status.get('closed', 0)}.\n"
        + ("آخر الحجوزات:\n" + "\n".join(
            f"- {b.get('publicId')} | {b.get('name')} | {_date(b.get('createdAt'))} | {_STATUS.get(b.get('status'), b.get('status'))}"
            f" | المرحلة: {_STAGE.get(b.get('stage'), b.get('stage'))} | {(b.get('details') or '')[:120]}"
            for b in recent[:12]) if recent else "مفيش حجوزات لسه.")
    )
    recent_c = data.get("recentContacts") or []
    contacts_text = (
        f"طلبات التواصل: إجمالي {contacts.get('total', 0)} (جديد {(contacts.get('byStatus') or {}).get('new', 0)}).\n"
        + ("آخر الطلبات:\n" + "\n".join(
            f"- {_date(c.get('createdAt'))} | {_TOPIC.get(c.get('topic'), c.get('topic'))} | {_STATUS.get(c.get('status'), c.get('status'))}"
            f" | {(c.get('note') or '')[:120]}"
            for c in recent_c[:12]) if recent_c else "مفيش طلبات لسه.")
    )
    stats = (
        f"إحصائيات: حجوزات {book.get('total', 0)}، طلبات تواصل {contacts.get('total', 0)}. "
        "الموقع مابيسجّلش عدد الزوار، فمعدل التحويل مش معروف."
    )
    return {"finance": finance, "bookings": bookings, "contacts": contacts_text, "stats": stats}


def facts_for_agents(sections: dict[str, str], roster: dict) -> dict[str, str]:
    """كل موظف بياخد الأقسام اللي عنده صلاحيتها بس (زي صلاحيات الموظفين في أي شركة).
    المدير التنفيذي (read_all) بياخد ملخص كل حاجة."""
    out: dict[str, str] = {}
    for agent_id, agent in roster.items():
        tools = set(agent.spec.tools)
        allowed = [name for name, tool in SECTION_TOOLS.items() if tool in tools or "read_all" in tools]
        if allowed:
            out[agent_id] = "\n".join(sections[name] for name in allowed if sections.get(name))
    return out


def format_site_facts(data: dict) -> dict[str, str]:
    """للتوافق: الأقسام بأسماء المالية والمشاريع والزوار."""
    sec = site_sections(data)
    return {"finance": sec["finance"], "projects": sec["bookings"], "analytics": sec["stats"]}


def fetch_site_facts(token: str, http=None, url: str = SITE_FACTS_URL) -> dict[str, str]:
    import httpx

    client = http or httpx.Client(timeout=30)
    r = client.get(url, headers={"Authorization": f"Bearer {token}", "User-Agent": "stratix-agents/0.1"})
    r.raise_for_status()
    return site_sections(r.json())
