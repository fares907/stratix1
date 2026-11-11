"""الـ Model Router: بيبعت لأي مزوّد OpenAI-compatible، ويتحول للاحتياطي أوتوماتيك.

الترتيب لكل طلب: الموديل الأساسي، وبعده الاحتياطي. أي موديل بيتخطّى لو:
  - مفتاحه مش موجود في .env
  - خلّص حدّه (في الدقيقة أو في اليوم)
  - المزوّد وقّفه بـ 429
  - الطلب حساس والمزوّد بيستخدم بيانات الخطة المجانية
وكل محاولة (نجحت أو فشلت) بتتسجل في جدول llm_calls.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Callable, Mapping

import httpx

from .config import Config, ModelSpec
from .ratelimit import RateTracker
from .store import Store

DEFAULT_COOLDOWN_SECONDS = 60.0


class Halted(RuntimeError):
    """زرار "إيقاف الكل" مضغوط."""


class AllModelsUnavailable(RuntimeError):
    def __init__(self, reasons: dict[str, str]):
        self.reasons = reasons
        detail = "؛ ".join(f"{k}: {v}" for k, v in reasons.items())
        super().__init__(f"مفيش موديل متاح دلوقتي — {detail}")


@dataclass(frozen=True)
class Completion:
    text: str
    model_key: str
    used_fallback: bool
    prompt_tokens: int
    completion_tokens: int


def _retry_after(response: httpx.Response) -> float:
    value = response.headers.get("retry-after", "")
    try:
        return max(1.0, float(value))
    except ValueError:
        return DEFAULT_COOLDOWN_SECONDS


class ModelRouter:
    def __init__(
        self,
        config: Config,
        store: Store,
        *,
        env: Mapping[str, str] | None = None,
        http: httpx.Client | None = None,
        tracker: RateTracker | None = None,
        clock: Callable[[], float] = time.monotonic,
        gateway: tuple[str, Callable[[], str]] | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.config = config
        self.store = store
        self.env = os.environ if env is None else env
        self.http = http or httpx.Client(timeout=90)
        self.tracker = tracker or RateTracker()
        self._clock = clock
        # (عنوان agents-gateway، دالة توكن OIDC): للمزوّدين اللي مفاتيحهم في Vault
        self.gateway = gateway
        self._sleep = sleep
        for key, count in store.usage_today().items():
            self.tracker.seed(key, count)

    def _skip_reason(self, spec: ModelSpec, sensitive: bool) -> str | None:
        provider = self.config.providers[spec.provider]
        has_key = not provider.api_key_env or self.env.get(provider.api_key_env)
        if not has_key and not (provider.via_gateway and self.gateway):
            return f"مفيش مفتاح ({provider.api_key_env})"
        if sensitive and provider.trains_on_free_data:
            return "بيانات حساسة — المزوّد ده ممنوع"
        return self.tracker.why_blocked(spec)

    def complete(
        self,
        agent_id: str,
        messages: list[dict],
        *,
        chain: list[str],
        sensitive: bool = False,
        temperature: float = 0.4,
        json_mode: bool = False,
    ) -> Completion:
        # لو المزوّد قال "استنى ثواني" (كل الفريق بيسأل في نفس الوقت)، نستنى ونجرّب تاني (لحد 3 مرات)
        for attempt in range(4):
            try:
                return self._complete_once(agent_id, messages, chain, sensitive, temperature, json_mode)
            except AllModelsUnavailable:
                wait = self._short_cooldown()
                if wait is None or attempt == 3:
                    raise
                self._sleep(wait)
        raise AssertionError("unreachable")

    def _short_cooldown(self, limit: float = 65.0) -> float | None:
        waits = [w for w in self.tracker.cooldowns() if 0 < w <= limit]
        return (min(waits) + 1) if waits else None

    def _complete_once(self, agent_id, messages, chain, sensitive, temperature, json_mode) -> Completion:
        if self.store.is_halted():
            raise Halted("الشركة واقفة بأمر رئيس مجلس الإدارة")

        reasons: dict[str, str] = {}
        # الأساسي والاحتياطي الأول، وبعدهم الاحتياطي العام لو الاتنين مش متاحين
        chain = list(dict.fromkeys([*chain, *self.config.last_resort]))
        for index, key in enumerate(chain):
            spec = self.config.model(key)
            skip = self._skip_reason(spec, sensitive)
            if skip:
                reasons[key] = skip
                continue

            provider = self.config.providers[spec.provider]
            body: dict = {
                "model": spec.model_id,
                "messages": messages,
                "temperature": temperature,
            }
            if json_mode:
                body["response_format"] = {"type": "json_object"}

            self.tracker.record(spec)
            started = self._clock()
            url, headers = self._endpoint(provider)
            try:
                response = self.http.post(
                    url,
                    json=body,
                    headers=headers,
                )
            except httpx.HTTPError as exc:
                reasons[key] = f"خطأ شبكة: {type(exc).__name__}"
                self._log(agent_id, spec, index, "network_error", started)
                continue

            if response.status_code == 429:
                self.tracker.cooldown(spec, _retry_after(response))
                reasons[key] = "المزوّد رجّع 429 (الحد خلص)"
                self._log(agent_id, spec, index, "rate_limited", started)
                continue
            if response.status_code == 400 and json_mode:
                # Groq بيرفض بـ 400 لو الموديل طلّع JSON مش سليم؛ نجرّب نفس الموديل من غير json_mode
                body.pop("response_format", None)
                try:
                    response = self.http.post(url, json=body, headers=headers)
                except httpx.HTTPError:
                    pass
            if response.status_code >= 400:
                reasons[key] = f"HTTP {response.status_code}"
                self._log(agent_id, spec, index, f"http_{response.status_code}", started)
                continue

            try:
                data = response.json()
                text = data["choices"][0]["message"]["content"] or ""
            except (ValueError, KeyError, IndexError, TypeError):
                reasons[key] = "رد مش مفهوم من المزوّد"
                self._log(agent_id, spec, index, "bad_response", started)
                continue

            usage = data.get("usage") or {}
            result = Completion(
                text=text,
                model_key=key,
                used_fallback=index > 0,
                prompt_tokens=int(usage.get("prompt_tokens") or 0),
                completion_tokens=int(usage.get("completion_tokens") or 0),
            )
            self._log(agent_id, spec, index, "ok", started, result)
            return result

        raise AllModelsUnavailable(reasons)

    def _endpoint(self, provider) -> tuple[str, dict[str, str]]:
        path = "/openai" if provider.base_url.endswith("pollinations.ai") else "/chat/completions"
        if not provider.api_key_env:
            return provider.base_url + path, {}
        key = self.env.get(provider.api_key_env)
        if key:
            return provider.base_url + path, {"Authorization": f"Bearer {key}"}
        base, token_fn = self.gateway  # via_gateway (اتأكدنا في _skip_reason)
        return f"{base}/llm/{provider.name}/chat/completions", {"Authorization": f"Bearer {token_fn()}"}

    def _log(
        self,
        agent_id: str,
        spec: ModelSpec,
        index: int,
        status: str,
        started: float,
        result: Completion | None = None,
    ) -> None:
        self.store.insert(
            "llm_calls",
            {
                "agent_id": agent_id,
                "provider": spec.provider,
                "model_key": spec.key,
                "model_id": spec.model_id,
                "is_fallback": index > 0,
                "status": status,
                "latency_ms": int((self._clock() - started) * 1000),
                "prompt_tokens": result.prompt_tokens if result else 0,
                "completion_tokens": result.completion_tokens if result else 0,
            },
        )
