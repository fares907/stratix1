import { afterEach, describe, expect, it, vi } from "vitest";
import { paymentDeclareSchema, paymentLookupSchema } from "./payment";

describe("payment lookup validation", () => {
  it("normalises the phone and upper-cases the order id", () => {
    const parsed = paymentLookupSchema.safeParse({
      publicId: "strx-11aa22bb33",
      phone: "01125839109",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.publicId).toBe("STRX-11AA22BB33");
      expect(parsed.data.phone).toBe("+201125839109");
    }
  });

  it("accepts an international phone", () => {
    const parsed = paymentLookupSchema.safeParse({ publicId: "STRX-1", phone: "+447911123456" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid phone", () => {
    expect(paymentLookupSchema.safeParse({ publicId: "STRX-1", phone: "123" }).success).toBe(false);
  });

  it("rejects an over-long order id", () => {
    const parsed = paymentLookupSchema.safeParse({
      publicId: "X".repeat(40),
      phone: "01125839109",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires a transfer reference when declaring", () => {
    const base = { publicId: "STRX-1", phone: "01125839109" };
    expect(paymentDeclareSchema.safeParse({ ...base, reference: "" }).success).toBe(false);
    expect(paymentDeclareSchema.safeParse({ ...base, reference: "TX-99182" }).success).toBe(true);
  });
});

describe("payment lookup behaviour", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  const booking = {
    publicId: "STRX-11AA22BB33",
    name: "منى عبد الرحمن",
    phone: "+201001112222",
    amountDue: "2500.00",
    currency: "EGP" as const,
    paymentStatus: "unpaid" as const,
  };

  it("returns the amount and payment methods for a matching order", async () => {
    vi.resetModules();
    vi.stubEnv("PAYMENT_INSTAPAY", "stratix@instapay");
    vi.stubEnv("PAYMENT_IBAN", "EG000000000000000000000000");
    const db = await import("./db");
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue(booking as never);

    const { lookupPayment } = await import("./payment");
    const result = await lookupPayment({ publicId: booking.publicId, phone: booking.phone });

    expect(result.amountDue).toBe("2500.00");
    expect(result.methods?.instapay).toBe("stratix@instapay");
    vi.unstubAllEnvs();
  });

  // An order id and a phone must BOTH match. Returning a different error for
  // "right id, wrong phone" would confirm which order ids exist.
  it("gives the same error whether the id or the phone is wrong", async () => {
    vi.resetModules();
    const db = await import("./db");
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue(undefined as never);

    const { lookupPayment } = await import("./payment");

    const wrongId = await lookupPayment({ publicId: "STRX-NOPE", phone: "+201001112222" }).catch(
      e => e.message,
    );
    const wrongPhone = await lookupPayment({
      publicId: booking.publicId,
      phone: "+201009999999",
    }).catch(e => e.message);

    expect(wrongId).toBe(wrongPhone);
  });

  // Until an owner quotes the project there is nothing to pay, so no account
  // details are handed out.
  it("withholds payment methods when no amount has been quoted", async () => {
    vi.resetModules();
    vi.stubEnv("PAYMENT_INSTAPAY", "stratix@instapay");
    const db = await import("./db");
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue({
      ...booking,
      amountDue: null,
    } as never);

    const { lookupPayment } = await import("./payment");
    const result = await lookupPayment({ publicId: booking.publicId, phone: booking.phone });

    expect(result.amountDue).toBeNull();
    expect(result.methods).toBeNull();
    vi.unstubAllEnvs();
  });

  it("stops a brute-force sweep of order ids", async () => {
    vi.resetModules();
    const db = await import("./db");
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue(undefined as never);

    const { lookupPayment } = await import("./payment");

    let throttled = false;
    for (let i = 0; i < 200; i++) {
      const message = await lookupPayment({
        publicId: `STRX-${i}`,
        phone: "+201001112222",
      }).catch(e => e.message);
      if (String(message).includes("محاولات كثيرة")) {
        throttled = true;
        break;
      }
    }

    expect(throttled).toBe(true);
  });
});

describe("confirming a payment sends the client a receipt", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  const unpaid = {
    publicId: "STRX-RECEIPT",
    name: "منى",
    clientEmail: "mona@example.com",
    phone: "+201001112222",
    amountDue: "2500.00",
    currency: "EGP" as const,
    paymentStatus: "awaiting_review" as const,
  };

  async function setup(booking: Record<string, unknown>) {
    vi.resetModules();
    const db = await import("./db");
    vi.spyOn(db, "getBookingByPublicId").mockResolvedValue(booking as never);
    vi.spyOn(db, "setBookingPaymentStatus").mockResolvedValue(undefined);
    const email = await import("./email");
    const receipt = vi
      .spyOn(email, "sendPaymentReceiptEmail")
      .mockResolvedValue({ status: "sent", messageId: "r1" });
    const { markPaymentStatus } = await import("./payment");
    return { markPaymentStatus, receipt };
  }

  it("emails the receipt when a booking becomes paid", async () => {
    const { markPaymentStatus, receipt } = await setup(unpaid);

    const result = await markPaymentStatus({ publicId: unpaid.publicId, paymentStatus: "paid" });

    expect(receipt).toHaveBeenCalledOnce();
    expect(result.receiptSent).toBe(true);
  });

  // Re-confirming a booking that is already paid must not send a second
  // receipt — the client would think they were charged twice.
  it("does not resend when the booking was already paid", async () => {
    const { markPaymentStatus, receipt } = await setup({ ...unpaid, paymentStatus: "paid" });

    const result = await markPaymentStatus({ publicId: unpaid.publicId, paymentStatus: "paid" });

    expect(receipt).not.toHaveBeenCalled();
    expect(result.receiptSent).toBe(false);
  });

  it("sends nothing when an owner reverses a confirmation", async () => {
    const { markPaymentStatus, receipt } = await setup({ ...unpaid, paymentStatus: "paid" });

    await markPaymentStatus({ publicId: unpaid.publicId, paymentStatus: "unpaid" });

    expect(receipt).not.toHaveBeenCalled();
  });

  // The client's email is optional at booking time. A missing address, or a
  // mail provider outage, must never fail the owner's confirmation — the money
  // is confirmed either way.
  it("still confirms the payment when the receipt cannot be sent", async () => {
    vi.resetModules();
    const db = await import("./db");
    vi.spyOn(db, "getBookingByPublicId").mockResolvedValue({
      ...unpaid,
      clientEmail: null,
    } as never);
    const setStatus = vi.spyOn(db, "setBookingPaymentStatus").mockResolvedValue(undefined);
    const email = await import("./email");
    vi.spyOn(email, "sendPaymentReceiptEmail").mockRejectedValue(new Error("provider down"));

    const { markPaymentStatus } = await import("./payment");
    const result = await markPaymentStatus({ publicId: unpaid.publicId, paymentStatus: "paid" });

    expect(setStatus).toHaveBeenCalledOnce();
    expect(result.updated).toBe(true);
    expect(result.receiptSent).toBe(false);
  });
});

describe("the receipt itself", () => {
  it("states the order, the amount and a keepable note in both languages", async () => {
    const { buildPaymentReceiptContent } = await import("./email");
    const booking = {
      publicId: "STRX-11AA22BB33",
      name: "منى عبد الرحمن",
      amountDue: "2500.00",
      currency: "EGP" as const,
    };

    const ar = buildPaymentReceiptContent(booking, "ar");
    expect(ar.subject).toContain("STRX-11AA22BB33");
    expect(ar.html).toContain("2500.00 EGP");
    expect(ar.html).toContain("إيصال");
    expect(ar.html).toContain('dir="rtl"');

    const en = buildPaymentReceiptContent(booking, "en");
    expect(en.subject.toLowerCase()).toContain("payment confirmed");
    expect(en.html).toContain('dir="ltr"');
  });

  it("escapes a name so it cannot inject markup into the email", async () => {
    const { buildPaymentReceiptContent } = await import("./email");
    const receipt = buildPaymentReceiptContent(
      {
        publicId: "STRX-1",
        name: '<script>alert(1)</script>',
        amountDue: "100.00",
        currency: "USD" as const,
      },
      "en",
    );

    expect(receipt.html).not.toContain("<script>");
    expect(receipt.html).toContain("&lt;script&gt;");
  });
});

describe("the invoice PDF", () => {
  const base = {
    publicId: "STRX-11AA22BB33",
    name: "Mona Abdelrahman",
    phone: "+201001112222",
    clientEmail: "mona@example.com",
    amountDue: "2500.00",
    currency: "EGP",
    paymentReference: "TX-83920184",
    paidAt: Date.now(),
  };

  it("produces a real single-page PDF", async () => {
    const { buildInvoicePdf } = await import("./invoicePdf");
    const pdf = await buildInvoicePdf(base);

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.toString("latin1")).toContain("/Count 1");
  });

  // Everything the client needs to identify the payment has to be on the page,
  // since this is the document they keep. Reading it back means undoing two
  // layers pdfkit applies: the content streams are deflate-compressed, and each
  // drawn string is written as hex inside a TJ array with kerning offsets
  // between the runs, so the hex chunks have to be decoded and rejoined.
  it("carries the order, amount, contact details and reference", async () => {
    const { buildInvoicePdf } = await import("./invoicePdf");
    const { inflateSync } = await import("node:zlib");

    const pdf = await buildInvoicePdf(base);
    const raw = pdf.toString("latin1");

    let content = "";
    for (const match of raw.matchAll(/stream\r?\n/g)) {
      const start = match.index! + match[0].length;
      const end = raw.indexOf("endstream", start);
      if (end < 0) continue;
      try {
        content += inflateSync(pdf.subarray(start, end)).toString("latin1");
      } catch {
        // Not every stream is a deflated content stream; skip those.
      }
    }

    // Each TJ array becomes one line of text once its hex runs are decoded.
    const lines = [...content.matchAll(/\[(.*?)\]\s*TJ/g)].map(([, body]) =>
      [...body.matchAll(/<([0-9A-Fa-f]+)>/g)]
        .map(([, hex]) => Buffer.from(hex, "hex").toString("latin1"))
        .join(""),
    );
    const drawn = lines.join("\n");

    for (const value of [base.publicId, base.name, base.phone, base.clientEmail, "2500.00", "TX-83920184"]) {
      expect(drawn).toContain(value);
    }
  });

  // A booking with no email and no transfer reference still has to render —
  // both fields are optional, and an exception here would cost the owner their
  // confirmation action.
  it("renders when the optional fields are absent", async () => {
    const { buildInvoicePdf } = await import("./invoicePdf");
    const pdf = await buildInvoicePdf({
      ...base,
      clientEmail: null,
      paymentReference: null,
      paidAt: null,
    });

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

describe("declaring a payment", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  const paidBooking = {
    publicId: "STRX-PAID",
    name: "أحمد",
    phone: "+201001112222",
    amountDue: "1000.00",
    currency: "EGP" as const,
    paymentStatus: "paid" as const,
  };

  // A client confirming twice must not email the owners again or reopen a
  // payment they already verified against the account.
  it("is a no-op when the booking is already marked paid", async () => {
    vi.resetModules();
    const db = await import("./db");
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue(paidBooking as never);
    const declareSpy = vi.spyOn(db, "declareBookingPayment").mockResolvedValue(undefined);
    const email = await import("./email");
    const emailSpy = vi.spyOn(email, "sendPaymentDeclaredEmail");

    const { declarePayment } = await import("./payment");
    const result = await declarePayment({
      publicId: paidBooking.publicId,
      phone: paidBooking.phone,
      reference: "TX-1",
    });

    expect(result.alreadyPaid).toBe(true);
    expect(declareSpy).not.toHaveBeenCalled();
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("refuses when no amount has been quoted yet", async () => {
    vi.resetModules();
    const db = await import("./db");
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue({
      ...paidBooking,
      amountDue: null,
      paymentStatus: "unpaid",
    } as never);

    const { declarePayment } = await import("./payment");
    await expect(
      declarePayment({ publicId: "STRX-PAID", phone: "+201001112222", reference: "TX-1" }),
    ).rejects.toThrow(/لم يتم تحديد مبلغ/);
  });

  // The client's word moves the booking to "awaiting review" only. Marking it
  // paid stays an owner action, after checking the account.
  it("records the claim as awaiting review, not as paid", async () => {
    vi.resetModules();
    const db = await import("./db");
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue({
      ...paidBooking,
      paymentStatus: "unpaid",
    } as never);
    const declareSpy = vi.spyOn(db, "declareBookingPayment").mockResolvedValue(undefined);
    const email = await import("./email");
    vi.spyOn(email, "sendPaymentDeclaredEmail").mockResolvedValue({
      status: "sent",
      messageId: "m1",
    });

    const { declarePayment } = await import("./payment");
    const result = await declarePayment({
      publicId: paidBooking.publicId,
      phone: paidBooking.phone,
      reference: "TX-42",
    });

    expect(result.accepted).toBe(true);
    expect(result.alreadyPaid).toBe(false);
    expect(declareSpy).toHaveBeenCalledWith({ publicId: "STRX-PAID", reference: "TX-42" });
  });
});
