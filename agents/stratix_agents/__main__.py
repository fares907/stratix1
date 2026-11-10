"""أوامر التشغيل:

  python -m stratix_agents check    يتأكد إن ملفات config سليمة
  python -m stratix_agents seed     ينسخ الفريق من team.yaml لـ Supabase (الجداد بس)
  python -m stratix_agents models   يسأل كل مزوّد عن الموديلات المتاحة فعلًا
  python -m stratix_agents scout    يشغّل الكشّاف
"""

from __future__ import annotations

import os
import sys

import httpx

from . import config as config_mod
from . import scout
from .agent import Agent
from .router import Halted, ModelRouter
from .store import SupabaseStore


def _store() -> SupabaseStore:
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("لازم SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في البيئة")
    return SupabaseStore(url, key)


def cmd_check(cfg: config_mod.Config) -> None:
    print(f"تمام: {len(cfg.agents)} موظف، {len(cfg.providers)} مزوّد")
    for a in cfg.agents.values():
        print(f"  {a.name:<8} {a.title:<28} {a.primary} ← {a.fallback}")


def cmd_seed(cfg: config_mod.Config) -> None:
    store = _store()
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


def cmd_scout(cfg: config_mod.Config) -> None:
    store = _store()
    agent = Agent(cfg.agents["scout"], cfg, ModelRouter(cfg, store), store)
    print(f"محلات جديدة: {scout.run(agent)}")


COMMANDS = {"check": cmd_check, "seed": cmd_seed, "models": cmd_models, "scout": cmd_scout}


def main(argv: list[str]) -> None:
    if len(argv) != 1 or argv[0] not in COMMANDS:
        sys.exit(__doc__)
    cfg = config_mod.load()
    try:
        COMMANDS[argv[0]](cfg)
    except Halted as exc:
        print(f"اتوقف: {exc}")


if __name__ == "__main__":
    main(sys.argv[1:])
