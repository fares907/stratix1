import PDFDocument from "pdfkit";

// A PDF invoice attached to the payment-confirmation email.
//
// The document is entirely in English. Arabic was tried first and abandoned:
// pdfkit lays text out with fontkit, whose Latin-tuned line metrics leave
// Arabic descenders (ب، ج، ي) colliding with the line below, and no amount of
// per-call lineGap tuning produced something worth sending a client. English
// also happens to be the right choice on its own merits — an invoice ends up
// with a bank or an accountant, and it reads the same for a client in Cairo,
// Riyadh or anywhere else.
//
// Sticking to English means the built-in Helvetica covers every glyph, so no
// font file has to be shipped or located at runtime.

export type InvoiceData = {
  publicId: string;
  name: string;
  phone: string;
  clientEmail: string | null;
  amountDue: string | null;
  currency: string;
  paymentReference: string | null;
  paidAt: number | null;
};

const INK = "#11100f";
const SIGNAL = "#ff6b1a";
const MUTED = "#6b6560";
const LINE = "#ddd8d2";
const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";

export function buildInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", chunk => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
      const issued = paidAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Cairo",
      });
      const amount = data.amountDue ? `${data.amountDue} ${data.currency}` : "—";

      // ── header ──────────────────────────────────────────────────────────
      doc.font(BOLD).fontSize(26).fillColor(INK).text("STRATIX", 50, 50);
      doc.font(REGULAR).fontSize(8).fillColor(SIGNAL)
        .text("DIGITAL ARCHITECTURE / CAIRO", 50, 82, { characterSpacing: 1.5 });

      doc.font(BOLD).fontSize(22).fillColor(INK)
        .text("INVOICE", 350, 48, { width: 195, align: "right" });
      doc.font(REGULAR).fontSize(9).fillColor(MUTED)
        .text(`Invoice no.   ${data.publicId}`, 300, 78, { width: 245, align: "right" })
        .text(`Issued   ${issued}`, 300, 93, { width: 245, align: "right" });

      doc.moveTo(50, 118).lineTo(545, 118).lineWidth(2).strokeColor(SIGNAL).stroke();

      // ── paid banner ─────────────────────────────────────────────────────
      doc.roundedRect(50, 140, 495, 56, 4).fillColor("#effaf3").fill();
      doc.font(BOLD).fontSize(12).fillColor("#1c7f4a")
        .text("PAYMENT RECEIVED", 70, 158, { characterSpacing: 0.8 });
      doc.font(REGULAR).fontSize(9).fillColor("#3d7a58")
        .text("Paid in full — thank you.", 70, 175);
      doc.font(BOLD).fontSize(19).fillColor("#1c7f4a")
        .text(amount, 320, 163, { width: 205, align: "right" });

      // ── billed to ───────────────────────────────────────────────────────
      let y = 228;
      doc.font(BOLD).fontSize(9).fillColor(MUTED)
        .text("BILLED TO", 50, y, { characterSpacing: 1 });
      y += 20;

      const field = (label: string, value: string) => {
        doc.font(REGULAR).fontSize(9).fillColor(MUTED).text(label, 50, y + 2, { width: 100 });
        doc.font(REGULAR).fontSize(11).fillColor(INK).text(value, 160, y, { width: 385 });
        y += 24;
      };

      field("Name", data.name);
      field("Phone", data.phone);
      if (data.clientEmail) field("Email", data.clientEmail);

      // ── detail table ────────────────────────────────────────────────────
      y += 18;
      doc.moveTo(50, y).lineTo(545, y).lineWidth(1).strokeColor(LINE).stroke();
      y += 14;

      doc.font(BOLD).fontSize(8).fillColor(MUTED)
        .text("DESCRIPTION", 50, y, { characterSpacing: 1 })
        .text("AMOUNT", 380, y, { width: 165, align: "right", characterSpacing: 1 });
      y += 18;
      doc.moveTo(50, y).lineTo(545, y).lineWidth(1).strokeColor(LINE).stroke();
      y += 18;

      doc.font(REGULAR).fontSize(11).fillColor(INK)
        .text("Website design & development", 50, y, { width: 300 });
      doc.font(REGULAR).fontSize(11).fillColor(INK)
        .text(amount, 380, y, { width: 165, align: "right" });
      y += 18;
      doc.font(REGULAR).fontSize(9).fillColor(MUTED)
        .text(`Order ${data.publicId}`, 50, y);
      y += 26;

      doc.moveTo(50, y).lineTo(545, y).lineWidth(1).strokeColor(LINE).stroke();
      y += 18;

      doc.font(BOLD).fontSize(11).fillColor(INK)
        .text("TOTAL PAID", 50, y + 5, { characterSpacing: 0.8 });
      doc.font(BOLD).fontSize(17).fillColor(SIGNAL)
        .text(amount, 320, y, { width: 225, align: "right" });
      y += 48;

      // ── payment details ─────────────────────────────────────────────────
      const boxHeight = data.paymentReference ? 76 : 56;
      doc.roundedRect(50, y, 495, boxHeight, 4).fillColor("#faf9f7").fill();
      const boxTop = y + 16;
      doc.font(BOLD).fontSize(8).fillColor(INK)
        .text("PAYMENT DETAILS", 70, boxTop, { characterSpacing: 1 });
      doc.font(REGULAR).fontSize(9).fillColor(MUTED)
        .text("Method", 70, boxTop + 20, { width: 90 });
      doc.font(REGULAR).fontSize(10).fillColor(INK)
        .text("Bank transfer / InstaPay", 165, boxTop + 19);
      if (data.paymentReference) {
        doc.font(REGULAR).fontSize(9).fillColor(MUTED)
          .text("Reference", 70, boxTop + 42, { width: 90 });
        doc.font(REGULAR).fontSize(10).fillColor(INK)
          .text(data.paymentReference, 165, boxTop + 41);
      }

      // ── footer ──────────────────────────────────────────────────────────
      // Sits just under the payment box rather than pinned to the page bottom:
      // a single-line invoice left roughly a third of the page empty between
      // the two, which read as a rendering fault rather than as white space.
      const footY = y + boxHeight + 48;
      doc.moveTo(50, footY).lineTo(545, footY).lineWidth(1).strokeColor(LINE).stroke();
      doc.font(REGULAR).fontSize(8).fillColor(MUTED)
        .text("STRATIX — Website design & development, Cairo, Egypt", 50, footY + 14)
        .text("stratix255@gmail.com    ·    +20 112 583 9109    ·    stratix.website", 50, footY + 27);
      doc.font(REGULAR).fontSize(8).fillColor(MUTED)
        .text("Thank you for your business.", 330, footY + 14, { width: 215, align: "right" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
