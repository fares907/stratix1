import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getBookingByRequestKey: vi.fn(),
  getRecentBookingSignals: vi.fn(),
  createBooking: vi.fn(),
  updateBookingEmailDelivery: vi.fn(),
}));

const sendBookingEmail = vi.hoisted(() => vi.fn());
const sendCustomerConfirmationEmail = vi.hoisted(() => vi.fn());
const notifyOwner = vi.hoisted(() => vi.fn());

vi.mock("./db", () => dbMocks);
vi.mock("./email", () => ({ sendBookingEmail, sendCustomerConfirmationEmail }));
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
    expect(validInput.phone).toBe("+201125839109");
  });

  it.each([
    ["a bare Egyptian number", "01125839109", "+201125839109"],
    ["an Egyptian number with country code", "+20 112 583 9109", "+201125839109"],
    ["a UK number", "+44 7400 123456", "+447400123456"],
    ["a Saudi number", "+966 50 123 4567", "+966501234567"],
    ["a US number", "+1 (415) 555-0132", "+14155550132"],
  ])("accepts %s and stores it in E.164", (_label, input, expected) => {
    expect(bookingInputSchema.parse({ ...validInput, phone: input }).phone).toBe(expected);
  });

  it("rejects invalid phones and filled honeypot fields", () => {
    expect(() => bookingInputSchema.parse({ ...validInput, phone: "123" })).toThrow();
    // libphonenumber's Egypt metadata accepts these, but they aren't real
    // Egyptian mobile numbers — our stricter national check must still reject.
    expect(() => bookingInputSchema.parse({ ...validInput, phone: "01625839109" })).toThrow();
    expect(() => bookingInputSchema.parse({ ...validInput, phone: "0221234567" })).toThrow();
    // Valid country code, but too few digits to be a real UK number.
    expect(() => bookingInputSchema.parse({ ...validInput, phone: "+44 1" })).toThrow();
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
    sendCustomerConfirmationEmail.mockResolvedValue({ status: "sent", messageId: "confirmation-id" });
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
    expect(sendCustomerConfirmationEmail).toHaveBeenCalledWith(booking, validInput.language);
  });

  it("skips the customer confirmation when no email was provided", async () => {
    dbMocks.createBooking.mockResolvedValue({ ...booking, clientEmail: null });

    await submitBooking({ ...validInput, clientEmail: undefined }, request);

    expect(sendCustomerConfirmationEmail).not.toHaveBeenCalled();
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
