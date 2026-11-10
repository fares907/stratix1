"""فلتر الرسايل قبل ما تطلع لأي عميل.

الرسايل بتطلع أوتوماتيك، بس الفلتر ده بيمسك أي رسالة فيها:
  - سعر برّا الحدود اللي في rules.yaml
  - وعد بميعاد تسليم أو مدة
  - خصم أو ضمان
والرسالة اللي يمسكها بتروح لصندوق الموافقات بدل ما تتبعت.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

# رقم (ممكن فيه فاصلة آلاف) جنبه عملة قبله أو بعده
_PRICE = re.compile(
    r"(?P<n>\d[\d,٬.]*)\s*(?:ألف\s*)?(?:جنيه|ج\.?م|EGP|LE|L\.E|\$|دولار)"
    r"|(?:جنيه|EGP|\$)\s*(?P<m>\d[\d,٬.]*)",
    re.IGNORECASE,
)
_THOUSAND = re.compile(r"(\d+(?:\.\d+)?)\s*ألف")

_DELIVERY = re.compile(
    r"(?:خلال|في|بعد)\s+(?:\d+\s*(?:يوم|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|ساعة|ساعات|شهر)"
    r"|يومين|أسبوع|اسبوع|أسبوعين|اسبوعين|شهر)"
    r"|هنسلم|هنسلّم|نسلم|نسلّم|التسليم",
)
_DISCOUNT = re.compile(r"خصم|عرض خاص|مجان[اًا]?\b|ببلاش|ضمان|مضمون|استرجاع الفلوس")


@dataclass(frozen=True)
class Verdict:
    ok: bool
    reasons: tuple[str, ...]


def _amount(text: str) -> float | None:
    cleaned = text.replace(",", "").replace("٬", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def check_message(text: str, *, price_min: int, price_max: int) -> Verdict:
    normalized = text.translate(_ARABIC_DIGITS)
    reasons: list[str] = []

    for match in _PRICE.finditer(normalized):
        raw = match.group("n") or match.group("m") or ""
        value = _amount(raw)
        if value is None:
            continue
        if "ألف" in match.group(0):
            value *= 1000
        if not price_min <= value <= price_max:
            reasons.append(f"سعر برّا الحدود: {value:g}")

    for match in _THOUSAND.finditer(normalized):
        value = float(match.group(1)) * 1000
        if not price_min <= value <= price_max:
            reasons.append(f"سعر برّا الحدود: {value:g}")

    if _DELIVERY.search(normalized):
        reasons.append("فيها وعد بميعاد تسليم")
    if _DISCOUNT.search(normalized):
        reasons.append("فيها خصم أو ضمان أو حاجة ببلاش")

    return Verdict(ok=not reasons, reasons=tuple(dict.fromkeys(reasons)))
