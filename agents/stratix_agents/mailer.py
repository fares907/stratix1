"""Gmail: إرسال (SMTP) وقراية الوارد (IMAP) بـ App Password.

App Password بيتعمل من حساب Google → Security → 2-Step Verification → App passwords.
"""

from __future__ import annotations

import email
import imaplib
import re
import smtplib
from dataclasses import dataclass
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr

SMTP_HOST, SMTP_PORT = "smtp.gmail.com", 587
IMAP_HOST = "imap.gmail.com"


@dataclass(frozen=True)
class Inbound:
    uid: str
    sender: str
    subject: str
    body: str
    message_id: str


class Mailer:
    def __init__(self, address: str, app_password: str, display_name: str = "STRATIX"):
        self.address = address
        self.password = app_password
        self.display_name = display_name

    def send(self, to: str, subject: str, body: str, *, in_reply_to: str | None = None) -> str:
        msg = EmailMessage()
        msg["From"] = formataddr((self.display_name, self.address))
        msg["To"] = to
        msg["Subject"] = subject
        msg["Message-ID"] = make_msgid(domain=self.address.split("@")[-1])
        # زرار "إلغاء الاشتراك" اللي Gmail بيعرضه فوق الرسالة
        msg["List-Unsubscribe"] = f"<mailto:{self.address}?subject=unsubscribe>"
        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
            msg["References"] = in_reply_to
        msg.set_content(body)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
            smtp.starttls()
            smtp.login(self.address, self.password)
            smtp.send_message(msg)
        return msg["Message-ID"]

    def unread(self, limit: int = 30) -> list[Inbound]:
        """الرسايل اللي لسه ماتقرتش، وبيعلّمها مقروءة."""
        result: list[Inbound] = []
        with imaplib.IMAP4_SSL(IMAP_HOST) as imap:
            imap.login(self.address, self.password)
            imap.select("INBOX")
            _, data = imap.uid("search", None, "UNSEEN")
            uids = (data[0] or b"").split()[-limit:]
            for uid in uids:
                _, parts = imap.uid("fetch", uid, "(RFC822)")
                raw = next((p[1] for p in parts if isinstance(p, tuple)), None)
                if not raw:
                    continue
                msg = email.message_from_bytes(raw)
                result.append(
                    Inbound(
                        uid=uid.decode(),
                        sender=parseaddr(msg.get("From", ""))[1].lower(),
                        subject=str(make_header(decode_header(msg.get("Subject", "")))),
                        body=_plain_text(msg),
                        message_id=msg.get("Message-ID", ""),
                    )
                )
        return result


def _plain_text(msg: email.message.Message) -> str:
    part = msg
    if msg.is_multipart():
        part = next((p for p in msg.walk() if p.get_content_type() == "text/plain"), None)
        if part is None:
            return ""
    payload = part.get_payload(decode=True) or b""
    text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
    # نشيل الاقتباس من الرسالة الأصلية عشان الموديل يقرا رد العميل بس
    text = re.split(r"\n(?:On .+wrote:|في .+كتب:|-{2,}\s*Original Message)", text)[0]
    return "\n".join(line for line in text.splitlines() if not line.startswith(">")).strip()


def normalize_egypt_phone(raw: str | None) -> str | None:
    """+20 10 1234 5678 / 01012345678 → 201012345678 (الشكل اللي wa.me عايزه)."""
    if not raw:
        return None
    first = re.split(r"[;,/]", raw)[0]
    digits = re.sub(r"\D", "", first)
    if digits.startswith("0020"):
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 11:
        digits = "20" + digits[1:]
    if digits.startswith("20") and len(digits) == 12:
        return digits
    return None
