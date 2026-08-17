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
