import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking } from "../drizzle/schema";

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", fetchMock);

vi.mock("./_core/env", () => ({
  ENV: {
    resendApiKey: "test-resend-key",
    resendFromAddress: "STRATIX <booking@stratix.website>",
    bookingEmailTo: "stratix255@gmail.com",
  },
}));

import { buildBookingEmailContent, buildCustomerConfirmationContent, sendBookingEmail, sendCustomerConfirmationEmail } from "./email";

const makeBooking = (clientEmail: string | null): Booking => ({
  id: 7,
  publicId: "STRX-SECURE01",
  requestKey: "00000000-0000-4000-8000-000000000007",
  clientHash: "b".repeat(64),
  name: "عميل <جديد>",
  phone: "01125839109",
  clientEmail,
  projectType: "personal",
  budget: "1500-3000",
  details: "أحتاج صفحة واضحة <script>alert('x')</script>",
  status: "new",
  emailStatus: "pending",
  emailMessageId: null,
  emailError: null,
  createdAt: 1_720_000_000_000,
  updatedAt: 1_720_000_000_000,
});

describe("booking email content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "resend-message-id" }),
    });
  });

  it("includes the booking data and escapes customer HTML", () => {
    const booking = makeBooking("client@example.com");

    const content = buildBookingEmailContent(booking);

    expect(content.subject).toContain(booking.publicId);
    expect(content.text).toContain(booking.phone);
    expect(content.html).toContain("&lt;script&gt;");
    expect(content.html).not.toContain("<script>alert");
  });

  it("sets reply_to when the customer provides an email", async () => {
    await expect(sendBookingEmail(makeBooking("client@example.com"))).resolves.toMatchObject({
      status: "sent",
      messageId: "resend-message-id",
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.reply_to).toBe("client@example.com");
    expect(requestInit.headers.Authorization).toBe("Bearer test-resend-key");
  });

  it("keeps reply_to empty when no customer email is provided", async () => {
    await sendBookingEmail(makeBooking(null));

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.reply_to).toBeUndefined();
  });

  it("reports a failed status when Resend responds with an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "Invalid from address" }),
    });

    await expect(sendBookingEmail(makeBooking(null))).resolves.toMatchObject({
      status: "failed",
      error: "Invalid from address",
    });
  });
});

describe("customer confirmation email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "resend-message-id" }),
    });
  });

  it("builds bilingual content that mentions the order number", () => {
    const booking = makeBooking("client@example.com");

    const ar = buildCustomerConfirmationContent(booking, "ar");
    expect(ar.text).toContain(booking.publicId);
    expect(ar.html).toContain('dir="rtl"');

    const en = buildCustomerConfirmationContent(booking, "en");
    expect(en.text).toContain(booking.publicId);
    expect(en.html).toContain('dir="ltr"');
  });

  it("sends to the customer's address when one was provided", async () => {
    const booking = makeBooking("client@example.com");

    await expect(sendCustomerConfirmationEmail(booking, "en")).resolves.toMatchObject({ status: "sent" });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.to).toBe("client@example.com");
  });

  it("skips sending when no customer email was provided", async () => {
    const booking = makeBooking(null);

    await expect(sendCustomerConfirmationEmail(booking, "ar")).resolves.toMatchObject({
      status: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
