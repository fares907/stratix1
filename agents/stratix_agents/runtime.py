"""الشركة وهي شغّالة: الإعدادات وقاعدة البيانات والـ router والموظفين في مكان واحد."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from dataclasses import dataclass, field

from . import config as config_mod
from .agent import Agent
from .config import AgentSpec, Config
from .router import ModelRouter
from .store import GitHubOIDC, Store, SupabaseStore


@dataclass
class Company:
    config: Config
    store: Store
    router: ModelRouter
    env: dict = field(default_factory=lambda: dict(os.environ))

    def roster(self, include_inactive: bool = False) -> dict[str, Agent]:
        """الموظفين من قاعدة البيانات (اللوحة هي المرجع)، ولو الجدول فاضي من team.yaml."""
        rows = self.store.select("agents")
        specs = [AgentSpec.from_row(r) for r in rows] if rows else list(self.config.agents.values())
        return {
            s.id: Agent(s, self.config, self.router, self.store)
            for s in specs
            if include_inactive or s.status == "active"
        }

    def agent(self, agent_id: str) -> Agent | None:
        return self.roster().get(agent_id)

    def rule(self, *path: str, default=None):
        node = self.config.rules
        for key in path:
            if not isinstance(node, dict) or key not in node:
                return default
            node = node[key]
        return node


def within_working_hours(rules: dict, now: datetime | None = None) -> tuple[bool, str]:
    hours = rules.get("working_hours") or {}
    if not hours:
        return True, ""
    zone = ZoneInfo(hours.get("timezone", "Africa/Cairo"))
    local = (now or datetime.now(timezone.utc)).astimezone(zone)
    start, end = int(hours.get("start", 8)), int(hours.get("end", 17))
    ok = start <= local.hour < end
    return ok, f"الساعة {local:%H:%M} بتوقيت القاهرة، ومواعيد العمل من {start} لـ {end}"


def from_env() -> Company:
    gateway = os.environ.get("SUPABASE_GATEWAY_URL")
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    cfg = config_mod.load()
    if url and key:
        store = SupabaseStore(url, key)
    elif gateway and os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"):
        store = SupabaseStore(gateway, token_fn=GitHubOIDC())
    else:
        sys.exit("لازم SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY، أو SUPABASE_GATEWAY_URL من جوه GitHub Actions")
    return Company(cfg, store, ModelRouter(cfg, store))
