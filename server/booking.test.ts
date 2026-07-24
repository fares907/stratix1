import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getBookingByRequestKey: vi.fn(),
  getRecentBookingSignals: vi.fn(),
  createBooking: vi.fn(),
  updateBookingEmailDelivery: vi.fn(),
}));

const sendBookingEmail = vi.hoisted(() => vi.fn());
const notifyOwner = vi.hoisted(() => vi.fn());

vi.mock("./db", () => dbMocks);
vi.mock("./email", () => ({ sendBookingEmail }));
vi.mock("./_core/notification", () => ({ notifyOwner }));

import { BOOKING_LIMITS, bookingInputSchema, submitBooking } from "./booking";

const request = {
  headers: {},
  ip: "203.0.113.9",
  socket: { remoteAddress: "203.0.113.9" },
  get: vi.fn(() => "vitest-browser"),
} as never;

const validInput = bookingInputSchema.parse({
  requestKey: "00000000-0000-4000-8000-000000000001",
  name: "  فارس   سامي  ",
  phone: "011 2583 9109",
  clientEmail: "client@example.com",
  projectType: "company",
  budget: "700-1500",
  details: "أحتاج موقع شركة سريعاً ومتجاوباً يعرض الخدمات بوضوح.",
  website: "",
});

const booking = {
  id: 1,
  publicId: "STRX-ABC1234567",
  requestKey: validInput.requestKey,
  clientHash: "a".repeat(64),
  name: validInput.name,
  phone: validInput.phone,
  clientEmail: validInput.clientEmail ?? null,
  projectType: validInput.projectType,
  budget: validInput.budget,
  details: validInput.details,
  status: "new" as const,
  emailStatus: "pending" as const,
  emailMessageId: null,
  emailError: null,
  createdAt: 1_720_000_000_000,
  updatedAt: 1_720_000_000_000,
};

describe("booking input", () => {
  it("normalizes a valid Arabic name and Egyptian phone number", () => {
    expect(validInput.name).toBe("فارس سامي");
    expect(validInput.phone).toBe("01125839109");
  });

  it("rejects invalid phones and filled honeypot fields", () => {
    expect(() => bookingInputSchema.parse({ ...validInput, phone: "123" })).toThrow();
    expect(() => bookingInputSchema.parse({ ...validInput, website: "spam.example" })).toThrow();
  });

  it("allows an empty details field but rejects a too-short one", () => {
    expect(bookingInputSchema.parse({ ...validInput, details: "" }).details).toBeUndefined();
    expect(() => bookingInputSchema.parse({ ...validInput, details: "short" })).toThrow();
  });
});

describe("submitBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getBookingByRequestKey.mockResolvedValue(undefined);
    dbMocks.getRecentBookingSignals.mockResolvedValue({ byClient: 0, byPhone: 0 });
    dbMocks.createBooking.mockResolvedValue(booking);
    dbMocks.updateBookingEmailDelivery.mockResolvedValue(undefined);
    sendBookingEmail.mockResolvedValue({ status: "sent", messageId: "smtp-message-id" });
    notifyOwner.mockResolvedValue(true);
  });

  it("persists once, sends email, and records delivery", async () => {
    const result = await submitBooking(validInput, request);

    expect(result).toMatchObject({
      accepted: true,
      publicId: booking.publicId,
      duplicate: false,
      emailSent: true,
    });
    expect(dbMocks.createBooking).toHaveBeenCalledTimes(1);
    expect(sendBookingEmail).toHaveBeenCalledWith(booking);
    expect(dbMocks.updateBookingEmailDelivery).toHaveBeenCalledWith({
      publicId: booking.publicId,
      status: "sent",
      messageId: "smtp-message-id",
      error: undefined,
    });
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("returns an existing booking for a repeated request key", async () => {
    dbMocks.getBookingByRequestKey.mockResolvedValue(booking);

    const result = await submitBooking(validInput, request);

    expect(result.duplicate).toBe(true);
    expect(dbMocks.createBooking).not.toHaveBeenCalled();
    expect(sendBookingEmail).not.toHaveBeenCalled();
  });

  it("rejects requests that exceed the shared database limit", async () => {
    dbMocks.getRecentBookingSignals.mockResolvedValue({
      byClient: BOOKING_LIMITS.perClient,
      byPhone: 0,
    });

    await expect(submitBooking(validInput, request)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(dbMocks.createBooking).not.toHaveBeenCalled();
  });
});
