"""الكشّاف: بيدوّر في OpenStreetMap على محلات ومطاعم مالهاش موقع.

بنستخدم Overpass API وبنلتزم بسياسته: طلب واحد كبير في التشغيل،
User-Agent واضح، ومن غير تكرار سريع.
"""

from __future__ import annotations

import httpx

# السيرفرات العامة بتبقى مزحومة أحيانًا (502/504/429)، فبنجرّب أكتر من واحد
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
USER_AGENT = "stratix-agents/0.1 (+https://stratix.website)"

_WEBSITE_TAGS = ("website", "contact:website", "url", "brand:website")
_PHONE_TAGS = ("phone", "contact:phone", "mobile", "contact:mobile", "contact:whatsapp")
_EMAIL_TAGS = ("email", "contact:email")
_SOCIAL_TAGS = ("contact:facebook", "facebook", "contact:instagram", "instagram")


def build_query(city_names: list[str], amenities: list[str], include_shops: bool) -> str:
    """المدينة ممكن تكون متسجلة بأكتر من اسم (Banha / Benha / بنها)، فبندوّر بيهم كلهم."""
    amenity_re = "|".join(amenities)
    names = "|".join(city_names)
    parts = []
    if amenities:
        parts.append(f'  nwr(area.city)["amenity"~"^({amenity_re})$"]["name"];')
    if include_shops:
        parts.append('  nwr(area.city)["shop"]["name"];')
    body = "\n".join(parts)
    return (
        "[out:json][timeout:120];\n"
        f'(area["boundary"="administrative"]["name:en"~"^({names})$"];'
        f' area["boundary"="administrative"]["name"~"^({names})$"];)->.city;\n'
        f"(\n{body}\n);\n"
        "out tags center;"
    )


def _first(tags: dict, keys: tuple[str, ...]) -> str | None:
    for key in keys:
        if tags.get(key):
            return tags[key]
    return None


def parse_leads(elements: list[dict], city: str) -> list[dict]:
    """يرجّع الأماكن اللي مالهاش أي tag لموقع، ومعاها طريقة تواصل واحدة على الأقل."""
    leads = []
    for el in elements:
        tags = el.get("tags") or {}
        if not tags.get("name") or _first(tags, _WEBSITE_TAGS):
            continue
        phone, email = _first(tags, _PHONE_TAGS), _first(tags, _EMAIL_TAGS)
        social = _first(tags, _SOCIAL_TAGS)
        if not (phone or email):
            continue
        center = el.get("center") or {}
        leads.append(
            {
                "osm_id": f"{el['type']}/{el['id']}",
                "name": tags["name"],
                "category": tags.get("amenity") or f"shop:{tags.get('shop')}",
                "city": city,
                "address": tags.get("addr:street") or tags.get("addr:full"),
                "phone": phone,
                "email": email,
                "social_url": social,
                "lat": el.get("lat", center.get("lat")),
                "lon": el.get("lon", center.get("lon")),
                "status": "new",
                "source": "openstreetmap",
            }
        )
    return leads


def fetch(query: str, http: httpx.Client | None = None, sleep=None, rounds: int = 3) -> list[dict]:
    """بيجرّب كل سيرفر، ولو كلهم مزحومين بيستنى (20 ثم 40 ثانية) ويعيد."""
    import time

    client = http or httpx.Client(timeout=150)
    wait = sleep or time.sleep
    last_error = "مفيش رد"
    for attempt in range(rounds):
        for url in OVERPASS_URLS:
            try:
                response = client.post(url, data={"data": query}, headers={"User-Agent": USER_AGENT})
            except httpx.HTTPError as exc:
                last_error = f"{url}: {type(exc).__name__}"
                continue
            if response.status_code in (429, 502, 503, 504):
                last_error = f"{url}: HTTP {response.status_code} (مزحوم)"
                continue
            response.raise_for_status()
            return response.json().get("elements", [])
        if attempt < rounds - 1:
            wait(20 * (attempt + 1))
    raise RuntimeError(f"سيرفرات الخريطة كلها مزحومة: {last_error}")


def run(agent, http: httpx.Client | None = None) -> int:
    """يشغّل الكشّاف ويحفظ النتائج. بيرجّع عدد المحلات الجديدة."""
    agent.ensure_can_work()
    agent.require("osm_search")
    targeting = agent.config.rules["targeting"]
    query = build_query(
        list(targeting.get("city_osm_names") or [targeting.get("city_osm_name_en", "Banha")]),
        list(targeting.get("amenity") or []),
        include_shops=targeting.get("shop") == "any",
    )
    elements = fetch(query, http)
    leads = parse_leads(elements, targeting["city"])

    agent.require("write_leads")
    known = {row["osm_id"] for row in agent.store.select("leads", source="openstreetmap")}
    fresh = [lead for lead in leads if lead["osm_id"] not in known]
    agent.store.upsert("leads", fresh, on_conflict="osm_id")
    agent.log(
        f"دوّرت في {targeting['city']}: لقيت {len(elements)} مكان، "
        f"منهم {len(leads)} مالهمش موقع ومعاهم رقم أو إيميل، "
        f"و{len(fresh)} جداد ماكانوش عندنا."
    )
    return len(fresh)
