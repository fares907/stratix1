"""إشعارات تليجرام لرئيس مجلس الإدارة.

TELEGRAM_BOT_TOKEN من @BotFather، و TELEGRAM_CHAT_ID هو الشات بتاعك بس.
أزرار الموافقة بتروح لـ /api/telegram في لوحة التحكم (هي اللي بتنفّذ القرار).
"""

from __future__ import annotations

import httpx


class Telegram:
    def __init__(self, token: str, chat_id: str, http: httpx.Client | None = None):
        self.base = f"https://api.telegram.org/bot{token}"
        self.chat_id = chat_id
        self.http = http or httpx.Client(timeout=20)

    def send(self, text: str, buttons: list[list[dict]] | None = None) -> None:
        body: dict = {"chat_id": self.chat_id, "text": text[:4000], "disable_web_page_preview": True}
        if buttons:
            body["reply_markup"] = {"inline_keyboard": buttons}
        try:
            self.http.post(f"{self.base}/sendMessage", json=body).raise_for_status()
        except httpx.HTTPError:
            pass  # الإشعار مش أهم من الشغل نفسه؛ كل حاجة متسجلة في اللوحة

    def approval(self, approval: dict) -> None:
        reasons = "، ".join(approval.get("reasons") or [])
        body = (approval.get("payload") or {}).get("body", "")
        self.send(
            f"🟡 موافقة مطلوبة #{approval['id']}\n{approval['summary']}\nالسبب: {reasons}\n\n{body[:1500]}",
            [[
                {"text": "✅ موافقة", "callback_data": f"approve:{approval['id']}"},
                {"text": "❌ رفض", "callback_data": f"reject:{approval['id']}"},
            ]],
        )


def from_env(env) -> Telegram | None:
    token, chat = env.get("TELEGRAM_BOT_TOKEN"), env.get("TELEGRAM_CHAT_ID")
    return Telegram(token, chat) if token and chat else None
