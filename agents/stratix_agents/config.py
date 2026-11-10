"""تحميل ملفات config/ والتأكد إنها سليمة قبل ما أي agent يشتغل."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class ModelSpec:
    key: str  # "groq:llama70b"
    provider: str
    model_id: str
    rpm: int
    rpd: int


@dataclass(frozen=True)
class ProviderSpec:
    name: str
    base_url: str
    api_key_env: str
    trains_on_free_data: bool
    models: dict[str, ModelSpec]


@dataclass(frozen=True)
class AgentSpec:
    id: str
    name: str
    title: str
    department: str
    primary: str
    fallback: str
    tools: tuple[str, ...]
    duties: tuple[str, ...] = ()
    sensitive: bool = False
    instructions: str = ""
    status: str = "active"

    @classmethod
    def from_row(cls, row: dict) -> "AgentSpec":
        """موظف من جدول agents (اللي اتعيّن أو اتعدّل من اللوحة)."""
        return cls(
            id=row["id"],
            name=row["name"],
            title=row["title"],
            department=row["department"],
            primary=row["primary_model"],
            fallback=row["fallback_model"],
            tools=tuple(row.get("tools") or ()),
            duties=tuple(row.get("duties") or ()),
            sensitive=bool(row.get("sensitive")),
            instructions=row.get("instructions") or "",
            status=row.get("status") or "active",
        )


@dataclass(frozen=True)
class Config:
    providers: dict[str, ProviderSpec]
    agents: dict[str, AgentSpec]
    rules: dict = field(default_factory=dict)

    def model(self, key: str) -> ModelSpec:
        provider, _, alias = key.partition(":")
        try:
            return self.providers[provider].models[alias]
        except KeyError:
            raise ConfigError(f"موديل غير معروف: {key}") from None


def _load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def parse_providers(raw: dict) -> dict[str, ProviderSpec]:
    providers: dict[str, ProviderSpec] = {}
    for name, p in (raw.get("providers") or {}).items():
        models = {
            alias: ModelSpec(
                key=f"{name}:{alias}",
                provider=name,
                model_id=str(m["id"]),
                rpm=int(m["rpm"]),
                rpd=int(m["rpd"]),
            )
            for alias, m in (p.get("models") or {}).items()
        }
        providers[name] = ProviderSpec(
            name=name,
            base_url=str(p["base_url"]).rstrip("/"),
            api_key_env=str(p["api_key_env"]),
            trains_on_free_data=bool(p.get("trains_on_free_data", False)),
            models=models,
        )
    return providers


def parse_agents(raw: dict) -> dict[str, AgentSpec]:
    agents: dict[str, AgentSpec] = {}
    for a in raw.get("agents") or []:
        spec = AgentSpec(
            id=str(a["id"]),
            name=str(a["name"]),
            title=str(a["title"]),
            department=str(a["department"]),
            primary=str(a["primary"]),
            fallback=str(a["fallback"]),
            tools=tuple(a.get("tools") or ()),
            duties=tuple(a.get("duties") or ()),
            sensitive=bool(a.get("sensitive", False)),
        )
        if spec.id in agents:
            raise ConfigError(f"agent مكرر: {spec.id}")
        agents[spec.id] = spec
    return agents


def validate(cfg: Config) -> None:
    for agent in cfg.agents.values():
        if agent.primary == agent.fallback:
            raise ConfigError(f"{agent.id}: الموديل الاحتياطي لازم يختلف عن الأساسي")
        for key in (agent.primary, agent.fallback):
            spec = cfg.model(key)
            if agent.sensitive and cfg.providers[spec.provider].trains_on_free_data:
                raise ConfigError(
                    f"{agent.id} شغال على بيانات حساسة، ومينفعش يستخدم {key}"
                    " لأن المزوّد ده بيستخدم بيانات الخطة المجانية"
                )
        if cfg.model(agent.primary).provider == cfg.model(agent.fallback).provider:
            raise ConfigError(
                f"{agent.id}: الاحتياطي لازم يكون من مزوّد تاني عشان لو الأول وقع"
            )
    pricing = cfg.rules.get("pricing") or {}
    if pricing and int(pricing["min"]) > int(pricing["max"]):
        raise ConfigError("pricing.min أكبر من pricing.max")


def load(config_dir: Path = CONFIG_DIR) -> Config:
    cfg = Config(
        providers=parse_providers(_load_yaml(config_dir / "providers.yaml")),
        agents=parse_agents(_load_yaml(config_dir / "team.yaml")),
        rules=_load_yaml(config_dir / "rules.yaml"),
    )
    validate(cfg)
    return cfg
