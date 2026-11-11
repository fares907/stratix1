"""أوامر التشغيل:

  python -m stratix_agents check     يتأكد إن ملفات config سليمة
  python -m stratix_agents seed      ينسخ الفريق وقائمة الموديلات لـ Supabase
  python -m stratix_agents models    يسأل كل مزوّد عن الموديلات المتاحة فعلًا
  python -m stratix_agents morning   يوم الشغل: كشّاف ← فحص الموقع ← اجتماع ← رسايل ← GitHub
  python -m stratix_agents evening   اجتماع آخر اليوم ← التقرير اليومي ← تليجرام
  python -m stratix_agents inbox     يقرا الردود وينفّذ الموافقات (كل ساعتين)

كل خطوة مستقلة: لو واحدة وقعت، الباقي بيكمل، والخطأ بيتسجل في غرفة الاجتماعات.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

import httpx

from . import config as config_mod
from . import devteam, meeting, notify, report, sales, scout, site, sitedb
from .mailer import Mailer
from .router import Halted
from .runtime import Company, from_env, within_working_hours


def _mailer(env) -> Mailer | None:
    address, password = env.get("GMAIL_ADDRESS"), env.get("GMAIL_APP_PASSWORD")
    return Mailer(address, password.replace(" ", "")) if address and password else None


def _step(company: Company, name: str, fn, *args):
    """خطوة واحدة؛ الفشل يتسجل ومايوقفش اليوم كله (إلا زرار الإيقاف)."""
    try:
        result = fn(*args)
        print(f"✓ {name}: {result if result is not None else 'تمام'}")
        return result
    except Halted:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"✗ {name}: {exc}")
        traceback.print_exc()
        try:
            company.store.insert("messages", {"agent_id": None, "kind": "error",
                                              "content": f"خطوة {name} وقعت: {type(exc).__name__}: {exc}"[:2000]})
        except Exception:  # noqa: BLE001
            pass
        return None


def _site_db_facts(company: Company) -> dict[str, str]:
    url = company.env.get("SITE_DATABASE_URL")
    if url:
        conn = sitedb.connect(url)
        try:
            return {
                "finance": sitedb.finance_facts(conn),
                "projects": sitedb.projects_facts(conn),
                "analytics": sitedb.analytics_facts(conn),
            }
        finally:
            conn.close()
    if company.env.get("ACTIONS_ID_TOKEN_REQUEST_URL"):
        # من غير أي مفتاح: الموقع نفسه بيدّي الأرقام لتوكن GitHub الخاص بالـ workflow ده بس
        from .store import GitHubOIDC

        return sitedb.fetch_site_facts(GitHubOIDC(audience="stratix-site")())
    missing = "أرقام الموقع مش متاحة في التشغيل ده."
    return {"finance": missing, "projects": missing, "analytics": missing}


def _save_facts(company: Company, facts: dict[str, str]) -> None:
    """آخر أرقام حقيقية، عشان الموظفين يردّوا منها في الشات (طارق والحسابات مثلًا)."""
    from datetime import datetime, timezone

    company.store.upsert("company_settings", [{
        "key": "latest_facts",
        "value": {**facts, "_at": datetime.now(timezone.utc).isoformat()},
    }], on_conflict="key")


def _github(company: Company) -> devteam.GitHub | None:
    token = company.env.get("AGENTS_GITHUB_TOKEN") or company.env.get("GITHUB_TOKEN")
    repo = company.env.get("GITHUB_REPOSITORY")
    return devteam.GitHub(token, repo) if token and repo else None


def _notify_new_approvals(company: Company) -> None:
    tg = notify.from_env(company.env)
    if tg is None:
        return
    from datetime import datetime, timezone

    for approval in company.store.select("approvals", status="pending"):
        if not approval.get("notified_at"):
            tg.approval(approval)
            company.store.update(
                "approvals", {"notified_at": datetime.now(timezone.utc).isoformat()}, id=approval["id"]
            )


# ── الأوامر ──────────────────────────────────────────────
def cmd_check(cfg: config_mod.Config) -> None:
    print(f"تمام: {len(cfg.agents)} موظف، {len(cfg.providers)} مزوّد")
    for a in cfg.agents.values():
        print(f"  {a.name:<8} {a.title:<28} {a.primary} ← {a.fallback}")


def cmd_seed(cfg: config_mod.Config) -> None:
    company = from_env()
    store = company.store
    existing = {row["id"] for row in store.select("agents")}
    new_rows = [
        {
            "id": a.id, "name": a.name, "title": a.title, "department": a.department,
            "primary_model": a.primary, "fallback_model": a.fallback,
            "tools": list(a.tools), "duties": list(a.duties), "sensitive": a.sensitive,
        }
        for a in cfg.agents.values()
        if a.id not in existing
    ]
    # اللي موجودين مابنلمسهمش: تعديلاتك من اللوحة هي اللي تكسب.
    store.upsert("agents", new_rows, on_conflict="id")
    print(f"اتضاف {len(new_rows)} موظف جديد، و{len(existing)} كانوا موجودين ماتلمسوش")

    catalog = [
        {
            "key": m.key, "provider": p.name, "model_id": m.model_id,
            "rpm": m.rpm, "rpd": m.rpd, "trains_on_free_data": p.trains_on_free_data,
            "base_url": p.base_url,
        }
        for p in cfg.providers.values()
        for m in p.models.values()
    ]
    store.upsert("model_catalog", catalog, on_conflict="key")
    print(f"قائمة الموديلات: {len(catalog)}")
    # التواريخ (renews_on) بتتحول نص عشان JSON
    rules = json.loads(json.dumps(cfg.rules, default=str))
    store.upsert("company_settings", [{"key": "rules", "value": rules}], on_conflict="key")


def cmd_models(cfg: config_mod.Config) -> None:
    with httpx.Client(timeout=30) as http:
        for p in cfg.providers.values():
            key = os.environ.get(p.api_key_env)
            if not key:
                print(f"{p.name}: مفيش مفتاح ({p.api_key_env})")
                continue
            try:
                r = http.get(f"{p.base_url}/models", headers={"Authorization": f"Bearer {key}"})
                r.raise_for_status()
                available = {m["id"].removeprefix("models/") for m in r.json().get("data", [])}
            except (httpx.HTTPError, ValueError, KeyError) as exc:
                print(f"{p.name}: مقدرتش أجيب القائمة ({exc})")
                continue
            for m in p.models.values():
                mark = "موجود" if m.model_id in available else "مش موجود — غيّره في providers.yaml"
                print(f"{m.key:<22} {m.model_id:<42} {mark}")


def cmd_probe(cfg: config_mod.Config) -> None:
    """يجرّب كل مزوّد متاح بطلب صغير ويطبع الرد الخام (للتشخيص)."""
    with httpx.Client(timeout=60) as http:
        for p in cfg.providers.values():
            if p.api_key_env and not os.environ.get(p.api_key_env):
                print(f"{p.name}: مفيش مفتاح")
                continue
            headers = {"Authorization": f"Bearer {os.environ[p.api_key_env]}"} if p.api_key_env else {}
            url = f"{p.base_url}/openai" if p.base_url.endswith("pollinations.ai") else f"{p.base_url}/chat/completions"
            m = next(iter(p.models.values()))
            for json_mode in (False, True):
                body = {"model": m.model_id, "temperature": 0.2,
                        "messages": [{"role": "system", "content": "رد بـ JSON فيه say."},
                                     {"role": "user", "content": "قول أهلا"}]}
                if json_mode:
                    body["response_format"] = {"type": "json_object"}
                try:
                    r = http.post(url, json=body, headers=headers)
                    print(f"{m.key} json={json_mode}: HTTP {r.status_code} {r.text[:400]!r}")
                except httpx.HTTPError as exc:
                    print(f"{m.key} json={json_mode}: {type(exc).__name__}")


def cmd_morning(cfg: config_mod.Config) -> None:
    company = from_env()
    mailer = _mailer(company.env)
    audit = Path(company.env.get("SITE_AUDIT_JSON", "audit.json"))

    scout_agent = company.agent("scout")
    if scout_agent:
        _step(company, "الكشّاف", scout.run, scout_agent)
    _step(company, "التأهيل", sales.qualify, company)
    checks = _step(company, "فحص الموقع", site.run, company, audit)
    extra = _step(company, "أرقام الموقع", _site_db_facts, company) or {}
    if checks:
        extra.update({a: checks.for_agent(a) for a in ("uptime", "security", "infra")})
    facts = report.build_facts(company, extra)
    _step(company, "حفظ الأرقام", _save_facts, company, facts)
    _step(company, "اجتماع الصبح", meeting.run, company, facts, "morning")
    _step(company, "الرسايل", sales.outreach, company, mailer)
    if mailer:
        _step(company, "الوارد", sales.inbox, company, mailer)
    _step(company, "تنفيذ الموافقات", sales.execute_approved, company, mailer)

    gh = _github(company)
    if gh and checks:
        _step(company, "Issues", devteam.file_issues, company, gh, checks.problems)
    if gh:
        _step(company, "مراجعة PRs", devteam.review_pulls, company, gh)
    _step(company, "إشعارات", _notify_new_approvals, company)


def cmd_evening(cfg: config_mod.Config) -> None:
    company = from_env()
    mailer = _mailer(company.env)
    if mailer:
        _step(company, "الوارد", sales.inbox, company, mailer)
    _step(company, "تنفيذ الموافقات", sales.execute_approved, company, mailer)
    extra = _step(company, "أرقام الموقع", _site_db_facts, company) or {}
    facts = report.build_facts(company, extra)
    _step(company, "حفظ الأرقام", _save_facts, company, facts)
    mid = _step(company, "اجتماع آخر اليوم", meeting.run, company, facts, "evening")
    daily = _step(company, "التقرير اليومي", report.write_daily, company, facts, mid)
    tg = notify.from_env(company.env)
    if tg and daily:
        tg.send(daily["headline"] + "\n\nالتقرير كامل في لوحة التحكم ← التقارير")
    _step(company, "إشعارات", _notify_new_approvals, company)


def cmd_inbox(cfg: config_mod.Config) -> None:
    company = from_env()
    mailer = _mailer(company.env)
    if mailer:
        _step(company, "الوارد", sales.inbox, company, mailer)
    _step(company, "تنفيذ الموافقات", sales.execute_approved, company, mailer)
    _step(company, "إشعارات", _notify_new_approvals, company)


COMMANDS = {
    "check": cmd_check, "seed": cmd_seed, "models": cmd_models,
    "probe": cmd_probe, "morning": cmd_morning, "evening": cmd_evening, "inbox": cmd_inbox,
}


def main(argv: list[str]) -> None:
    if len(argv) != 1 or argv[0] not in COMMANDS:
        sys.exit(__doc__)
    cfg = config_mod.load()
    if argv[0] in ("morning", "evening", "inbox"):
        ok, why = within_working_hours(cfg.rules)
        if not ok:
            print(f"برّا مواعيد العمل — مفيش شغل. {why}")
            return
    try:
        COMMANDS[argv[0]](cfg)
    except Halted as exc:
        print(f"اتوقف: {exc}")


if __name__ == "__main__":
    main(sys.argv[1:])
