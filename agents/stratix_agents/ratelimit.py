"""تتبّع حدود كل موديل (في الدقيقة وفي اليوم) والإيقاف المؤقت بعد 429."""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

from .config import ModelSpec


def _utc_day(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


@dataclass
class _Usage:
    minute: deque = field(default_factory=deque)
    day: str = ""
    day_count: int = 0
    cooldown_until: float = 0.0


class RateTracker:
    """الحدود اليومية بتتصفّر على منتصف الليل UTC، زي أغلب المزوّدين."""

    def __init__(self, clock: Callable[[], float] = time.time):
        self._clock = clock
        self._usage: dict[str, _Usage] = {}

    def _get(self, key: str) -> _Usage:
        u = self._usage.setdefault(key, _Usage())
        now = self._clock()
        while u.minute and now - u.minute[0] >= 60:
            u.minute.popleft()
        today = _utc_day(now)
        if u.day != today:
            u.day, u.day_count = today, 0
        return u

    def seed(self, key: str, day_count: int) -> None:
        """يكمّل من العدد المتسجل في قاعدة البيانات (كل تشغيل بيبدأ من الصفر)."""
        self._get(key).day_count = day_count

    def why_blocked(self, spec: ModelSpec) -> str | None:
        u = self._get(spec.key)
        now = self._clock()
        if now < u.cooldown_until:
            return f"موقوف من المزوّد لمدة {int(u.cooldown_until - now)} ثانية"
        if u.day_count >= spec.rpd:
            return f"خلّص الحد اليومي ({spec.rpd})"
        if len(u.minute) >= spec.rpm:
            return f"خلّص حد الدقيقة ({spec.rpm})"
        return None

    def record(self, spec: ModelSpec) -> None:
        u = self._get(spec.key)
        u.minute.append(self._clock())
        u.day_count += 1

    def cooldown(self, spec: ModelSpec, seconds: float) -> None:
        u = self._get(spec.key)
        u.cooldown_until = max(u.cooldown_until, self._clock() + seconds)

    def used_today(self, key: str) -> int:
        return self._get(key).day_count
