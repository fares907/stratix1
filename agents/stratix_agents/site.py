"""فريق الموقع والأمان: فحوصات حقيقية بالكود، والموديل بيلخّص بس.

  - يوسف (uptime): الموقع شغال؟ سرعته؟ الـ SSL هيخلص إمتى؟
  - زياد (security): الـ security headers، والمكتبات اللي فيها ثغرات (pnpm audit)
  - رامي (infra): الدومين هيخلص إمتى (RDAP)، والاشتراكات اللي في rules.yaml
الفحص الشامل بيحصل كل FULL_CHECK_DAYS أيام، والسريع كل يوم.
"""

from __future__ import annotations

import json
import socket
import ssl
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx

FULL_CHECK_DAYS = 3
SECURITY_HEADERS = {
    "strict-transport-security": "HSTS",
    "content-security-policy": "Content-Security-Policy",
    "x-content-type-options": "X-Content-Type-Options",
    "referrer-policy": "Referrer-Policy",
}


@dataclass
class Finding:
    owner: str           # كود الموظف المسؤول
    severity: str        # ok / warn / critical
    text: str


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)

    def add(self, owner: str, severity: str, text: str) -> None:
        self.findings.append(Finding(owner, severity, text))

    def for_agent(self, agent_id: str) -> str:
        lines = [f"[{f.severity}] {f.text}" for f in self.findings if f.owner == agent_id]
        return "\n".join(lines) or "مفيش فحص النهارده."

    @property
    def problems(self) -> list[Finding]:
        return [f for f in self.findings if f.severity != "ok"]


def cert_days_left(host: str, port: int = 443, timeout: float = 15) -> int:
    ctx = ssl.create_default_context()
    with socket.create_connection((host, port), timeout=timeout) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as tls:
            not_after = tls.getpeercert()["notAfter"]
    expires = datetime.fromtimestamp(ssl.cert_time_to_seconds(not_after), tz=timezone.utc)
    return (expires - datetime.now(timezone.utc)).days


def domain_days_left(domain: str, http: httpx.Client) -> int | None:
    r = http.get(f"https://rdap.org/domain/{domain}", follow_redirects=True)
    r.raise_for_status()
    for event in r.json().get("events", []):
        if event.get("eventAction") == "expiration":
            expires = datetime.fromisoformat(event["eventDate"].replace("Z", "+00:00"))
            return (expires - datetime.now(timezone.utc)).days
    return None


def check_uptime(report: Report, url: str, http: httpx.Client) -> None:
    host = urlparse(url).hostname or ""
    started = time.monotonic()
    try:
        r = http.get(url, follow_redirects=True)
        ms = int((time.monotonic() - started) * 1000)
        if r.status_code >= 400:
            report.add("uptime", "critical", f"الموقع يُرجع خطأ (HTTP {r.status_code})")
        else:
            report.add("uptime", "warn" if ms > 3000 else "ok", f"الموقع يعمل بصورة طبيعية، وزمن تحميل الصفحة الرئيسية {ms} مللي ثانية")
        headers = {k.lower() for k in r.headers}
        missing = [name for key, name in SECURITY_HEADERS.items() if key not in headers]
        if missing:
            report.add("security", "warn", "ترويسات أمان ناقصة: " + "، ".join(missing))
        else:
            report.add("security", "ok", "جميع ترويسات الأمان الأساسية مُفعّلة")
    except httpx.HTTPError as exc:
        report.add("uptime", "critical", f"الموقع لا يستجيب ({type(exc).__name__})")
    try:
        days = cert_days_left(host)
        sev = "critical" if days < 7 else "warn" if days < 20 else "ok"
        report.add("uptime", sev, f"شهادة SSL سارية لمدة {days} يومًا")
    except (OSError, ssl.SSLError) as exc:
        report.add("uptime", "critical", f"خلل في شهادة SSL: {exc}")


# ملفات لو اتفتحت للناس تبقى كارثة (أسرار، كود، نسخ احتياطية)
SENSITIVE_PATHS = ("/.env", "/.git/config", "/.git/HEAD", "/package.json", "/server/_core/index.ts",
                   "/backup.sql", "/.DS_Store", "/drizzle.config.ts")


def check_exposure(report: Report, url: str, http: httpx.Client) -> None:
    """فحص أمان أعمق: ملفات حساسة مكشوفة، تحويل HTTP لـ HTTPS، وإن السيرفر مش بيفضح نسخته."""
    base = url.rstrip("/")
    exposed = []
    for path in SENSITIVE_PATHS:
        try:
            r = http.get(base + path, follow_redirects=False)
        except httpx.HTTPError:
            continue
        body = r.text[:400].lower() if r.status_code == 200 else ""
        # الموقع SPA: أي مسار مش موجود بيرجّع صفحة الموقع العادية (HTML)، ودي مش تسريب
        if r.status_code == 200 and "<html" not in body and "<!doctype" not in body:
            exposed.append(path)
    if exposed:
        report.add("security", "critical", "ملفات حساسة متاحة للعامة: " + "، ".join(exposed))
    else:
        report.add("security", "ok", f"لا توجد ملفات حساسة مكشوفة (فُحص {len(SENSITIVE_PATHS)} مسارًا مثل .env و.git)")

    host = urlparse(url).hostname or ""
    try:
        r = http.get(f"http://{host}/", follow_redirects=False)
        location = r.headers.get("location", "")
        if r.status_code in (301, 302, 307, 308) and location.startswith("https://"):
            report.add("security", "ok", "يُحوَّل كل زائر تلقائيًا إلى الاتصال الآمن HTTPS")
        else:
            report.add("security", "warn", f"الاتصال غير الآمن HTTP لا يُحوَّل إلى HTTPS (HTTP {r.status_code})")
    except httpx.HTTPError:
        pass

    try:
        r = http.get(url)
        leaks = [f"{k}: {r.headers[k]}" for k in ("x-powered-by", "server") if k in r.headers and any(ch.isdigit() for ch in r.headers[k])]
        if "x-powered-by" in r.headers:
            leaks.append(f"x-powered-by: {r.headers['x-powered-by']}")
        if leaks:
            report.add("security", "warn", "الخادم يكشف نوعه أو إصداره: " + "، ".join(dict.fromkeys(leaks)))
        else:
            report.add("security", "ok", "الخادم لا يكشف نوعه ولا إصداره")
    except httpx.HTTPError:
        pass


def check_audit(report: Report, audit_json: Path) -> None:
    """بيقرا ناتج `pnpm audit --json` اللي الـ workflow بيشغّله على الموقع."""
    if not audit_json.exists():
        report.add("security", "warn", "لم يُجرَ فحص المكتبات البرمجية (ملف الفحص غير موجود)")
        return
    try:
        data = json.loads(audit_json.read_text(encoding="utf-8") or "{}")
    except ValueError:
        report.add("security", "warn", "تعذّرت قراءة نتيجة فحص المكتبات البرمجية")
        return
    counts = (data.get("metadata") or {}).get("vulnerabilities") or {}
    serious = int(counts.get("high", 0)) + int(counts.get("critical", 0))
    advisories = list((data.get("advisories") or {}).values())[:5]
    names = "، ".join(f"{a.get('module_name')} ({a.get('severity')})" for a in advisories)
    if serious:
        report.add("security", "critical", f"{serious} ثغرة خطيرة في مكتبات الموقع: {names}")
    elif any(counts.values()):
        report.add("security", "warn", f"ثغرات منخفضة الخطورة في المكتبات: {dict(counts)}")
    else:
        report.add("security", "ok", "لا توجد ثغرات معروفة في مكتبات الموقع")


def check_infra(report: Report, domain: str, subscriptions: list[dict], http: httpx.Client, today: date | None = None) -> None:
    today = today or date.today()
    try:
        days = domain_days_left(domain, http)
        if days is None:
            report.add("infra", "warn", "تعذّر معرفة تاريخ انتهاء النطاق")
        else:
            sev = "critical" if days < 14 else "warn" if days < 45 else "ok"
            report.add("infra", sev, f"النطاق {domain} ساري لمدة {days} يومًا")
    except (httpx.HTTPError, ValueError) as exc:
        report.add("infra", "warn", f"تعذّر فحص النطاق ({type(exc).__name__})")
    for sub in subscriptions:
        renews = sub.get("renews_on")
        if not renews:
            continue
        renews_date = renews if isinstance(renews, date) else date.fromisoformat(str(renews))
        left = (renews_date - today).days
        what = f"{sub.get('name')} ({sub.get('note', '')})".strip()
        if left < 0:
            report.add("infra", "critical", f"اشتراك {what} تجاوز موعد تجديده بـ {-left} يومًا — يُرجى التأكد من السداد وتحديث التاريخ")
        elif left <= int(sub.get("remind_days", 7)):
            report.add("infra", "warn", f"اشتراك {what} مستحق السداد خلال {left} يومًا")
        else:
            report.add("infra", "ok", f"اشتراك {what} ساري لمدة {left} يومًا")


def last_full_check(store) -> datetime | None:
    rows = [r for r in store.select("site_checks") if r.get("kind") == "full"]
    stamps = [datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")) for r in rows if r.get("created_at")]
    return max(stamps) if stamps else None


def run(company, audit_json: Path | None = None, http: httpx.Client | None = None, force_full: bool = False) -> Report:
    client = http or httpx.Client(timeout=30, headers={"User-Agent": "stratix-agents/0.1"})
    url = company.rule("company", "website", default="https://stratix.website")
    domain = urlparse(url).hostname or ""
    report = Report()

    last = last_full_check(company.store)
    full = force_full or last is None or (datetime.now(timezone.utc) - last).days >= FULL_CHECK_DAYS

    check_uptime(report, url, client)
    check_exposure(report, url, client)
    check_infra(report, domain, company.rule("subscriptions", default=[]) or [], client)
    if full and audit_json is not None:
        check_audit(report, audit_json)

    company.store.insert("site_checks", {
        "kind": "full" if full else "quick",
        "ok": not any(f.severity == "critical" for f in report.findings),
        "details": [f.__dict__ for f in report.findings],
    })
    for agent_id in ("uptime", "security", "infra"):
        agent = company.agent(agent_id)
        if agent:
            agent.log(("فحص شامل:\n" if full and agent_id == "security" else "") + report.for_agent(agent_id),
                      kind="error" if any(f.owner == agent_id and f.severity == "critical" for f in report.findings) else "activity")
    return report
