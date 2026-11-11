"use client";

/**
 * بيحوّل أي جزء من الصفحة لملف PDF (A4) وينزّله.
 * بنصوّر الجزء بالمتصفح نفسه، فالعربي والخطوط بيطلعوا زي ما هما بالظبط.
 */
export async function downloadPdf(element: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  // نسخة بخلفية بيضا عشان تتطبع واضحة
  const source = (element.querySelector(".doc") as HTMLElement | null) ?? element;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add("pdf-export");
  clone.querySelectorAll("[data-no-pdf]").forEach(n => n.remove());
  clone.querySelectorAll("details").forEach(d => d.setAttribute("open", ""));
  Object.assign(clone.style, { position: "fixed", top: "0", left: "-10000px", direction: "rtl" });
  document.body.appendChild(clone);
  try {
    await document.fonts?.ready;
    const SCALE = 2;
    // أماكن ينفع الصفحة تتقطع عندها (آخر كل صف/فقرة/بند) عشان مانقطعش سطر في النص
    const top = clone.getBoundingClientRect().top;
    const breaks = Array.from(
      clone.querySelectorAll(".doc-section, .doc-section > :not(h2), tr, .doc-li, .doc-prose > *, .doc-task, li, .doc-kpi, .doc-head, .doc-to, p"),
    ).map(el => Math.round((el.getBoundingClientRect().bottom - top) * SCALE)).sort((a, b) => a - b);
    const canvas = await html2canvas(clone, { scale: SCALE, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const scale = usableW / canvas.width;
    const sliceH = Math.floor(usableH / scale); // كام بكسل من الصورة في كل صفحة

    for (let y = 0, page = 0; y < canvas.height; page++) {
      let end = Math.min(y + sliceH, canvas.height);
      if (end < canvas.height) {
        const fit = breaks.filter(b => b > y + sliceH * 0.55 && b <= end);
        if (fit.length) end = fit[fit.length - 1] + 6;
      }
      const h = end - y;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, usableW, h * scale);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`STRATIX - ${page + 1}`, pageW / 2, pageH - 10, { align: "center" });
      y = end;
    }
    pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
  } finally {
    clone.remove();
  }
}
