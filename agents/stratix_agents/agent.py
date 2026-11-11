"""الموظف: هويته وصلاحياته، وكل كلمة بيقولها بتتسجل في غرفة الاجتماعات."""

from __future__ import annotations

import json

from .config import AgentSpec, Config
from .router import Completion, Halted, ModelRouter
from .store import Store


class NotAllowed(PermissionError):
    pass


class AgentInactive(RuntimeError):
    pass


def _rules_block(rules: dict) -> str:
    pricing = rules.get("pricing") or {}
    honesty = "\n".join(f"- {line}" for line in rules.get("honesty") or [])
    company = rules.get("company") or {}
    chairmen = " و".join(company.get("chairmen") or [])
    return (
        f"الشركة: {company.get('name', 'STRATIX')} — {company.get('what_we_do', '')}\n"
        + (f"أصحاب الشركة ورؤساء مجلس الإدارة: {chairmen}. كلامهم أوامر للفريق كله.\n" if chairmen else "")
        + f"الأسعار المسموحة: من {pricing.get('min')} لـ {pricing.get('max')} "
        f"{pricing.get('currency', 'جنيه')}. {pricing.get('guidance', '')}\n"
        f"قوانين الأمانة:\n{honesty}"
    )


class Agent:
    def __init__(self, spec: AgentSpec, config: Config, router: ModelRouter, store: Store):
        self.spec = spec
        self.config = config
        self.router = router
        self.store = store

    # ── الحالة والصلاحيات ──────────────────────────────────
    def _db_row(self) -> dict | None:
        rows = self.store.select("agents", id=self.spec.id)
        return rows[0] if rows else None

    def ensure_can_work(self) -> dict:
        if self.store.is_halted():
            raise Halted("الشركة واقفة بأمر رئيس مجلس الإدارة")
        row = self._db_row() or {}
        status = row.get("status", "active")
        if status != "active":
            raise AgentInactive(f"{self.spec.name} حالته {status}")
        return row

    def require(self, tool: str) -> None:
        row = self._db_row() or {}
        tools = row.get("tools") or list(self.spec.tools)
        if tool not in tools:
            raise NotAllowed(f"{self.spec.name} مالوش صلاحية {tool}")

    # ── الكلام ───────────────────────────────────────────
    def system_prompt(self, row: dict) -> str:
        instructions = row.get("instructions") or ""
        duties = "\n".join(f"- {d}" for d in self.spec.duties)
        return (
            f"انت {self.spec.name}، {self.spec.title} في شركة STRATIX.\n"
            f"مهامك:\n{duties}\n{instructions}\n\n"
            f"{_rules_block(self.config.rules)}\n\n"
            "رد دايمًا بـ JSON فيه: "
            '"say" (كلامك)، "reasoning" (سببك باختصار)، '
            '"confidence" (high أو medium أو low)، "unknowns" (قائمة باللي مش متأكد منه).'
        )

    def think(self, prompt: str, *, meeting_id: int | None = None, reply_to: int | None = None) -> dict:
        row = self.ensure_can_work()
        chain = [row.get("primary_model") or self.spec.primary,
                 row.get("fallback_model") or self.spec.fallback]
        completion = self.router.complete(
            self.spec.id,
            [
                {"role": "system", "content": self.system_prompt(row)},
                {"role": "user", "content": prompt},
            ],
            chain=chain,
            sensitive=self.spec.sensitive,
            json_mode=True,
        )
        parsed = parse_reply(completion)
        message = self.store.insert(
            "messages",
            {
                "agent_id": self.spec.id,
                "meeting_id": meeting_id,
                "reply_to": reply_to,
                "kind": "speech",
                "content": parsed["say"],
                "reasoning": parsed["reasoning"],
                "confidence": parsed["confidence"],
                "unknowns": parsed["unknowns"],
                "model_key": completion.model_key,
                "used_fallback": completion.used_fallback,
            },
        )
        return {**parsed, "message_id": message["id"]}

    def log(self, content: str, *, kind: str = "activity", meeting_id: int | None = None) -> None:
        self.store.insert(
            "messages",
            {"agent_id": self.spec.id, "meeting_id": meeting_id, "kind": kind, "content": content},
        )


def parse_reply(completion: Completion) -> dict:
    """لو الموديل مارجّعش JSON سليم، بنسجل كلامه زي ما هو بثقة low."""
    try:
        data = json.loads(completion.text)
        if not isinstance(data, dict):
            raise ValueError
    except ValueError:
        return {
            "say": completion.text.strip(),
            "reasoning": "",
            "confidence": "low",
            "unknowns": ["الموديل مارجّعش الرد بالشكل المطلوب"],
        }
    confidence = data.get("confidence")
    unknowns = data.get("unknowns") or []
    return {
        **data,  # أي حقول زيادة طلبناها (ask، tasks، ...)
        "say": str(data.get("say", "")).strip(),
        "reasoning": str(data.get("reasoning", "")).strip(),
        "confidence": confidence if confidence in ("high", "medium", "low") else "low",
        "unknowns": [str(u) for u in unknowns] if isinstance(unknowns, list) else [str(unknowns)],
    }
