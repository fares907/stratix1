"""الشركة وهي شغّالة: الإعدادات وقاعدة البيانات والـ router والموظفين في مكان واحد."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field

from . import config as config_mod
from .agent import Agent
from .config import AgentSpec, Config
from .router import ModelRouter
from .store import Store, SupabaseStore


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


def from_env() -> Company:
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("لازم SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في البيئة")
    cfg = config_mod.load()
    store = SupabaseStore(url, key)
    return Company(cfg, store, ModelRouter(cfg, store))
