"""الوصول لقاعدة البيانات.

SupabaseStore بيكلم Supabase عن طريق REST (PostgREST) بمفتاح service_role —
المفتاح ده بيتحط في GitHub Secrets بس، وعمره ما بيوصل للمتصفح.
MemoryStore نفس الواجهة في الذاكرة، للاختبارات والتجربة من غير Supabase.
"""

from __future__ import annotations

import itertools
from datetime import datetime, timezone
from typing import Any, Protocol

import httpx


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


class Store(Protocol):
    def insert(self, table: str, row: dict) -> dict: ...
    def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None: ...
    def select(self, table: str, **eq: Any) -> list[dict]: ...
    def update(self, table: str, values: dict, **eq: Any) -> None: ...
    def is_halted(self) -> bool: ...
    def usage_today(self) -> dict[str, int]: ...


class MemoryStore:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {}
        self.halted = False
        self._ids = itertools.count(1)

    def insert(self, table: str, row: dict) -> dict:
        stored = {"id": next(self._ids), **row}
        self.tables.setdefault(table, []).append(stored)
        return stored

    def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        keys = on_conflict.split(",")
        existing = self.tables.setdefault(table, [])
        for row in rows:
            match = next(
                (r for r in existing if all(r.get(k) == row.get(k) for k in keys)),
                None,
            )
            if match:
                match.update(row)
            else:
                existing.append({"id": next(self._ids), **row})

    def select(self, table: str, **eq: Any) -> list[dict]:
        return [
            r
            for r in self.tables.get(table, [])
            if all(r.get(k) == v for k, v in eq.items())
        ]

    def update(self, table: str, values: dict, **eq: Any) -> None:
        for row in self.select(table, **eq):
            row.update(values)

    def is_halted(self) -> bool:
        return self.halted

    def usage_today(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for row in self.tables.get("llm_calls", []):
            counts[row["model_key"]] = counts.get(row["model_key"], 0) + 1
        return counts


class SupabaseStore:
    def __init__(self, url: str, service_key: str, http: httpx.Client | None = None):
        self.base = url.rstrip("/") + "/rest/v1"
        self.http = http or httpx.Client(timeout=30)
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _filters(eq: dict[str, Any]) -> dict[str, str]:
        return {k: f"eq.{v}" for k, v in eq.items()}

    def insert(self, table: str, row: dict) -> dict:
        r = self.http.post(
            f"{self.base}/{table}",
            json=row,
            headers={**self.headers, "Prefer": "return=representation"},
        )
        r.raise_for_status()
        return r.json()[0]

    def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        if not rows:
            return
        r = self.http.post(
            f"{self.base}/{table}",
            params={"on_conflict": on_conflict},
            json=rows,
            headers={
                **self.headers,
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
        )
        r.raise_for_status()

    def select(self, table: str, **eq: Any) -> list[dict]:
        r = self.http.get(
            f"{self.base}/{table}", params=self._filters(eq), headers=self.headers
        )
        r.raise_for_status()
        return r.json()

    def update(self, table: str, values: dict, **eq: Any) -> None:
        r = self.http.patch(
            f"{self.base}/{table}",
            params=self._filters(eq),
            json=values,
            headers=self.headers,
        )
        r.raise_for_status()

    def is_halted(self) -> bool:
        # لو قاعدة البيانات مش بترد نعتبر الشركة واقفة: الأمان قبل الشغل.
        try:
            rows = self.select("system_state", id=1)
        except httpx.HTTPError:
            return True
        return bool(rows and rows[0].get("halted"))

    def usage_today(self) -> dict[str, int]:
        r = self.http.post(
            f"{self.base}/rpc/llm_usage_for_day",
            json={"day": _today_utc()},
            headers=self.headers,
        )
        r.raise_for_status()
        return {row["model_key"]: int(row["calls"]) for row in r.json()}
