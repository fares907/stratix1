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
