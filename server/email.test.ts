import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking } from "../drizzle/schema";

const sendMail = vi.hoisted(() => vi.fn());
const close = vi.hoisted(() => vi.fn());

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail, close }),
  },
}));

vi.mock("./_core/env", () => ({
  ENV: {
    gmailSmtpUser: "stratix255@gmail.com",
    gmailAppPassword: "test-app-password",
    bookingEmailTo: "stratix255@gmail.com",
  },
}));

import { buildBookingEmailContent, sendBookingEmail } from "./email";

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
    sendMail.mockResolvedValue({ messageId: "smtp-message-id" });
  });

  it("includes the booking data and escapes customer HTML", () => {
    const booking = makeBooking("client@example.com");

    const content = buildBookingEmailContent(booking);

    expect(content.subject).toContain(booking.publicId);
    expect(content.text).toContain(booking.phone);
    expect(content.html).toContain("&lt;script&gt;");
    expect(content.html).not.toContain("<script>alert");
  });

  it("sets Reply-To when the customer provides an email", async () => {
    await expect(sendBookingEmail(makeBooking("client@example.com"))).resolves.toMatchObject({
      status: "sent",
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "client@example.com" }),
    );
  });

  it("keeps Reply-To empty when no customer email is provided", async () => {
    await sendBookingEmail(makeBooking(null));

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: undefined }));
  });
});
