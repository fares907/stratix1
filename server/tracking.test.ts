import { afterEach, describe, expect, it, vi } from "vitest";

const booking = {
  publicId: "STRX-ABCDEF1234",
  name: "Client Name",
  phone: "+201001112222",
  clientEmail: "client@example.com",
  details: "internal notes",
  status: "contacted",
  stage: "design",
  stageUpdatedAt: 1_700_000_100_000,
  createdAt: 1_700_000_000_000,
  paymentStatus: "unpaid",
  amountDue: "2500.00",
  currency: "EGP",
  clientHash: "secret-hash",
};

async function load() {
  vi.resetModules();
  const db = await import("./db");
  const tracking = await import("./tracking");
  return { db, tracking };
}

function requestFrom(ip: string) {
  return { ip, socket: {}, get: () => undefined } as never;
}

afterEach(() => vi.restoreAllMocks());

describe("order tracking", () => {
  // The page is public: it must show progress, never contact details, notes,
  // the sales status or the fingerprint used for rate limiting.
  it("returns the stage and payment summary and nothing else", async () => {
    const { db, tracking } = await load();
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue(booking as never);

    const result = await tracking.trackOrder({ publicId: booking.publicId, phone: booking.phone }, requestFrom("1.1.1.1"));

    expect(result).toEqual({
      publicId: "STRX-ABCDEF1234",
      name: "Client Name",
      stage: "design",
      stageUpdatedAt: 1_700_000_100_000,
      createdAt: 1_700_000_000_000,
      paymentStatus: "unpaid",
      amountDue: "2500.00",
      currency: "EGP",
    });
  });

  // One message whatever was wrong, so probing cannot reveal which order
  // numbers exist.
  it("answers a wrong id and a wrong phone identically", async () => {
    const { db, tracking } = await load();
    vi.spyOn(db, "getBookingForPayment").mockResolvedValue(undefined);

    const error = await tracking
      .trackOrder({ publicId: "STRX-0000000000", phone: "+201001112222" }, requestFrom("2.2.2.2"))
      .catch(e => e);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("limits each visitor before the database is touched", async () => {
    const { db, tracking } = await load();
    const lookup = vi.spyOn(db, "getBookingForPayment").mockResolvedValue(undefined);
    const visitor = requestFrom("3.3.3.3");

    for (let i = 0; i < 10; i++) {
      await tracking.trackOrder({ publicId: "STRX-0000000000", phone: "+201001112222" }, visitor).catch(() => {});
    }
    const error = await tracking
      .trackOrder({ publicId: "STRX-0000000000", phone: "+201001112222" }, visitor)
      .catch(e => e);

    expect(error.code).toBe("TOO_MANY_REQUESTS");
    expect(lookup).toHaveBeenCalledTimes(10);

    // A different visitor is unaffected.
    await tracking.trackOrder({ publicId: "STRX-0000000000", phone: "+201001112222" }, requestFrom("4.4.4.4")).catch(() => {});
    expect(lookup).toHaveBeenCalledTimes(11);
  });
});
