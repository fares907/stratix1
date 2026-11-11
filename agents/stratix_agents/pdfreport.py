"""التقرير اليومي كملف PDF حقيقي (نص مش صورة).

بنبني صفحة HTML بنفس تصميم اللوحة، والمتصفح (Chromium) بيطبعها PDF بمحرّك الطباعة بتاعه:
العربي بيتشكّل صح، والكلام بيتنسخ وبيتبحث فيه، والصفحات بتتقسم بين الصفوف.
الخطوط جوه الملف نفسه (مش من النت) عشان الشكل يطلع واحد في كل مرة.
"""

from __future__ import annotations

import base64
import re
from datetime import date
from html import escape
from pathlib import Path

FONTS = Path(__file__).parent / "fonts"

MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]
IDEA = {"approved": ("معتمدة", "ok"), "rejected": ("مرفوضة", "critical"), "pending": ("قيد الدراسة", "warn")}


def long_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{DAYS[d.weekday()]}، {d.day} {MONTHS[d.month - 1]} {d.year}"


def _font(name: str) -> str:
    return base64.b64encode((FONTS / name).read_bytes()).decode()


def _font_faces() -> str:
    faces = [
        ("Alexandria", "alexandria-arabic-wght-normal.woff2", "100 900", "U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E"),
        ("Alexandria", "alexandria-latin-wght-normal.woff2", "100 900", "U+0000-00FF, U+2000-206F"),
        ("Plex", "ibm-plex-sans-arabic-arabic-400-normal.woff2", "400", "U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E"),
        ("Plex", "ibm-plex-sans-arabic-arabic-600-normal.woff2", "600 800", "U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E"),
        ("Plex", "ibm-plex-sans-arabic-latin-400-normal.woff2", "400", "U+0000-00FF, U+2000-206F"),
        ("Plex", "ibm-plex-sans-arabic-latin-600-normal.woff2", "600 800", "U+0000-00FF, U+2000-206F"),
    ]
    return "\n".join(
        f"@font-face{{font-family:'{fam}';src:url(data:font/woff2;base64,{_font(file)}) format('woff2');"
        f"font-weight:{weight};unicode-range:{rng};font-display:block}}"
        for fam, file, weight, rng in faces
    )


CSS = """
@page { size: A4; margin: 16mm 15mm 18mm; }
* { box-sizing: border-box; letter-spacing: normal; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Plex', sans-serif; color: #17142b; font-size: 10.5pt; line-height: 1.8; direction: rtl; }
h1, h2, h3, h4, .display { font-family: 'Alexandria', sans-serif; }
.head { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 3px solid #5b2be0;
  border-image: linear-gradient(270deg, #5b2be0, #c026d3) 1; }
.brand { display: flex; gap: 10px; align-items: center; }
.logo { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #5b2be0, #c026d3); color: #fff;
  display: flex; align-items: center; justify-content: center; font-family: 'Alexandria'; font-weight: 800; font-size: 18pt; }
.brand b { display: block; font-family: 'Alexandria'; font-size: 17pt; letter-spacing: 0.08em; line-height: 1.2; }
.brand span, .meta span { color: #6b6880; font-size: 9pt; }
.meta { text-align: left; }
.meta h1 { margin: 0; font-size: 16pt; line-height: 1.3; }
.to { display: flex; justify-content: space-between; background: #f6f4fc; border-radius: 8px; padding: 7px 12px; margin: 12px 0 2px; font-size: 9.5pt; }
.to span { color: #6b6880; }
section { margin-top: 16px; }
h2 { font-size: 12.5pt; margin: 0 0 8px; display: flex; align-items: center; gap: 8px; break-after: avoid; }
h2 .n { background: #5b2be0; color: #fff; border-radius: 5px; padding: 0 7px; font-size: 8.5pt; line-height: 1.7; }
h3 { font-size: 10.5pt; margin: 0 0 4px; }
.lead { margin: 0; padding-right: 12px; border-right: 3px solid #5b2be0; font-size: 11pt; text-align: justify; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.kpi { border: 1px solid #e6e3f0; border-radius: 10px; padding: 8px 12px; background: #fbfaff; break-inside: avoid; }
.kpi span { display: block; color: #6b6880; font-size: 8.5pt; }
.kpi b { display: block; font-family: 'Alexandria'; font-size: 17pt; color: #5b2be0; line-height: 1.35; }
.kpi.ok b { color: #0f8a4b; } .kpi.warn b { color: #b26a00; }
.kpi small { color: #6b6880; font-size: 8pt; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
ul.dots { list-style: none; margin: 0; padding: 0; }
ul.dots li { position: relative; padding-right: 16px; margin: 3px 0; break-inside: avoid; }
ul.dots li::before { content: ""; position: absolute; right: 2px; top: 0.72em; width: 6px; height: 6px; border-radius: 50%; background: #5b2be0; }
ul.dots.ok li::before { background: #0f8a4b; } ul.dots.warn li::before { background: #d97706; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #f3f0fb; text-align: right; font-weight: 600; padding: 6px 8px; border-bottom: 2px solid #e6e3f0; }
td { padding: 6px 8px; border-bottom: 1px solid #e6e3f0; vertical-align: top; unicode-bidi: plaintext; text-align: right; }
td.v { text-align: left; font-family: 'Alexandria'; font-weight: 700; color: #5b2be0; width: 90px; }
td.who { white-space: nowrap; font-weight: 600; }
.pill { display: inline-block; white-space: nowrap; border-radius: 999px; padding: 0 9px; font-size: 8.5pt; font-weight: 600; background: #eef; }
.pill.ok { background: #e3f6ec; color: #0f7a43; } .pill.warn { background: #fff3dc; color: #9a5b00; } .pill.critical { background: #fde4e4; color: #b42318; }
.muted { color: #6b6880; font-size: 9pt; }
.task { border: 1px solid #e6e3f0; border-radius: 10px; padding: 8px 12px; margin-bottom: 8px; break-inside: avoid; }
.task .th { display: flex; justify-content: space-between; border-bottom: 1px dashed #e6e3f0; padding-bottom: 4px; margin-bottom: 4px; }
.task .th span { color: #6b6880; font-size: 9pt; }
.task p { margin: 3px 0; }
ol.num { list-style: none; counter-reset: n; margin: 0; padding: 0; }
ol.num li { counter-increment: n; display: flex; gap: 8px; margin: 4px 0; break-inside: avoid; }
ol.num li::before { content: counter(n); flex: none; width: 19px; height: 19px; border-radius: 50%; background: #efeafd; color: #5b2be0;
  font-size: 8.5pt; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 3px; }
.foot { margin-top: 22px; padding-top: 8px; border-top: 1px solid #e6e3f0; color: #6b6880; font-size: 8pt; display: flex; justify-content: space-between; }
"""


_LATIN = re.compile(r"[A-Za-z0-9._/:@+-]*[A-Za-z][A-Za-z0-9._/:@+-]*")


def _e(value) -> str:
    """نص آمن، والكلمات الإنجليزي (زي .env أو Railway) بتتعزل عشان ماتتقلبش جوه الجملة العربي."""
    text = str(value if value is not None else "")
    out, last = [], 0
    for m in _LATIN.finditer(text):
        out.append(escape(text[last:m.start()]))
        out.append(f"<bdi dir='ltr'>{escape(m.group(0))}</bdi>")
        last = m.end()
    out.append(escape(text[last:]))
    return "".join(out)


def _prose(text: str) -> str:
    out, items = [], []
    for raw in (text or "").splitlines():
        line = raw.strip().replace("**", "")
        if not line:
            continue
        if line[:2] in ("- ", "• ", "* "):
            items.append(f"<li>{_e(line[2:])}</li>")
            continue
        if items:
            out.append(f"<ul class='dots'>{''.join(items)}</ul>")
            items = []
        out.append(f"<h3>{_e(line.lstrip('# '))}</h3>" if line.startswith("#") else f"<p>{_e(line)}</p>")
    if items:
        out.append(f"<ul class='dots'>{''.join(items)}</ul>")
    return "".join(out)


def build_html(data: dict) -> str:
    sections: list[str] = []

    def section(title: str, body: str) -> None:
        sections.append(f"<section><h2><span class='n'>{len(sections) + 1:02d}</span>{_e(title)}</h2>{body}</section>")

    section("الملخص التنفيذي", f"<p class='lead'>{_e(data.get('summary'))}</p>")
    kpis = "".join(
        f"<div class='kpi {escape(str(k.get('tone', '')))}'><span>{_e(k['label'])}</span><b>{_e(k['value'])}</b>"
        f"<small>{_e(k.get('hint', ''))}</small></div>" for k in data.get("kpis", [])
    )
    section("المؤشرات الرئيسية", f"<div class='kpis'>{kpis}</div>")

    hi, risks = data.get("highlights") or [], data.get("risks") or []
    if hi or risks:
        def bullets(items: list, tone: str, empty: str) -> str:
            if not items:
                return f"<p class='muted'>{empty}</p>"
            return f"<ul class='dots {tone}'>" + "".join(f"<li>{_e(x)}</li>" for x in items) + "</ul>"

        section("أبرز الوقائع والمخاطر",
                "<div class='two'>"
                f"<div><h3>أبرز ما تم</h3>{bullets(hi, 'ok', 'لا يوجد.')}</div>"
                f"<div><h3>المخاطر والملاحظات</h3>{bullets(risks, 'warn', 'لا توجد مخاطر مسجّلة.')}</div>"
                "</div>")

    rows = "".join(f"<tr><td>{_e(l)}</td><td class='v'>{_e(v)}</td></tr>" for l, v in (data.get("sales") or {}).get("rows", []))
    section("المبيعات والتواصل مع العملاء", f"<table><tbody>{rows}</tbody></table>")

    finance = data.get("finance") or data.get("finance_raw")
    if finance:
        section("الوضع المالي", _prose(finance))

    site_rows = "".join(
        f"<tr><td class='who'>{_e(c['area'])}</td><td>{_e(c['text'])}</td>"
        f"<td><span class='pill {escape(str(c.get('status', '')))}'>{_e(c['status_label'])}</span></td></tr>"
        for c in data.get("site", [])
    ) or "<tr><td colspan='3' class='muted'>لم يُجرَ فحص اليوم.</td></tr>"
    section("الموقع والأمان", f"<table><thead><tr><th>المجال</th><th>البند</th><th>الحالة</th></tr></thead><tbody>{site_rows}</tbody></table>")

    if data.get("ideas"):
        idea_rows = "".join(
            f"<tr><td class='who'>{_e(i['who'])}</td><td>{_e(i['idea'])}"
            + (f"<div class='muted'>السبب: {_e(i['reason'])}</div>" if i.get("reason") else "")
            + f"</td><td><span class='pill {IDEA.get(i['status'], ('', ''))[1]}'>{IDEA.get(i['status'], (i['status'], ''))[0]}</span></td></tr>"
            for i in data["ideas"]
        )
        section("قرارات الاجتماعات", f"<table><thead><tr><th>صاحب المقترح</th><th>المقترح</th><th>القرار</th></tr></thead><tbody>{idea_rows}</tbody></table>")

    if data.get("tasks_done"):
        section("المهام المُنجزة اليوم", "".join(
            f"<div class='task'><div class='th'><b>{_e(t['title'])}</b><span>{_e(t['who'])}"
            f"{(' — ' + _e(t['role'])) if t.get('role') else ''}</span></div>{_prose(t['result'])}</div>"
            for t in data["tasks_done"]
        ))

    if data.get("recommendations"):
        section("التوصيات", "<ol class='num'>" + "".join(f"<li>{_e(r)}</li>" for r in data["recommendations"]) + "</ol>")

    approvals = data.get("approvals") or []
    body = ("<ol class='num'>" + "".join(f"<li>{_e(a)}</li>" for a in approvals) + "</ol>") if approvals else "<p class='muted'>لا توجد قرارات معلّقة.</p>"
    open_tasks = data.get("tasks_open") or []
    if open_tasks:
        body += f"<p class='muted'>مهام قيد التنفيذ: {len(open_tasks)} مهمة.</p>"
    section("بانتظار موافقتكم", body)

    return f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>STRATIX — التقرير اليومي {_e(data.get('date'))}</title><style>{_font_faces()}{CSS}</style></head><body>
<div class="head"><div class="brand"><div class="logo">S</div><div><b>STRATIX</b><span>لتصميم وتطوير المواقع</span></div></div>
<div class="meta"><h1>التقرير اليومي</h1><span>{_e(long_date(data['date']))}</span></div></div>
<div class="to"><div>إلى: السيد/ فارس والسيد/ يوسف — رئيسَي مجلس الإدارة</div><span>من: نادر، المدير التنفيذي</span></div>
{''.join(sections)}
<div class="foot"><span>أُعدّ هذا التقرير آليًا من بيانات الشركة الفعلية؛ جميع الأرقام مستخرجة من قاعدة البيانات مباشرةً.</span><span>stratix.website</span></div>
</body></html>"""


FOOTER = ("<div style='width:100%;font-size:8px;color:#8a879b;text-align:center;font-family:sans-serif'>"
          "STRATIX &middot; <span class='pageNumber'></span> / <span class='totalPages'></span></div>")


def render_pdf(html: str, executable_path: str | None = None) -> bytes:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(**({"executable_path": executable_path} if executable_path else {}))
        page = browser.new_page()
        page.set_content(html, wait_until="load")
        page.evaluate("document.fonts.ready")
        pdf = page.pdf(format="A4", print_background=True, prefer_css_page_size=True,
                       display_header_footer=True, header_template="<span></span>", footer_template=FOOTER)
        browser.close()
    return pdf


def attach(company, row: dict) -> int:
    """بيعمل الـ PDF للتقرير ويحفظه معاه (اللوحة بتنزّله زي ما هو)."""
    import os

    pdf = render_pdf(build_html(row["data"]), os.environ.get("CHROMIUM_PATH") or None)
    company.store.update("daily_reports", {"pdf": base64.b64encode(pdf).decode()}, report_date=row["report_date"])
    return len(pdf)
