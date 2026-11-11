"use client";

/**
 * بيحوّل أي جزء من الصفحة لملف PDF (A4) وينزّله.
 * بنصوّر الجزء بالمتصفح نفسه، فالعربي والخطوط بيطلعوا زي ما هما بالظبط.
 */
export async function downloadPdf(element: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  // نسخة بخلفية بيضا عشان تتطبع واضحة
  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add("pdf-export");
  clone.querySelectorAll("[data-no-pdf]").forEach(n => n.remove());
  clone.querySelectorAll("details").forEach(d => d.setAttribute("open", ""));
  Object.assign(clone.style, { position: "fixed", top: "0", left: "-10000px", direction: "rtl" });
  document.body.appendChild(clone);
  try {
    const canvas = await html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const scale = usableW / canvas.width;
    const sliceH = Math.floor(usableH / scale); // كام بكسل من الصورة في كل صفحة

    for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
      const h = Math.min(sliceH, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, usableW, h * scale);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`STRATIX - ${page + 1}`, pageW / 2, pageH - 10, { align: "center" });
    }
    pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
  } finally {
    clone.remove();
  }
}
