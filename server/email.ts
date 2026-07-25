import type { Booking } from "../drizzle/schema";
import { ENV } from "./_core/env";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_ADDRESS = "STRATIX <onboarding@resend.dev>";

export type BookingEmailResult =
  | { status: "sent"; messageId: string }
  | { status: "failed" | "not_configured"; error: string };

const projectTypeLabels: Record<Booking["projectType"], string> = {
  company: "موقع شركة",
  personal: "موقع شخصي",
  other: "فكرة أخرى",
};

const budgetLabels: Record<Booking["budget"], string> = {
  "700-1500": "700 — 1,500 جنيه",
  "1500-3000": "1,500 — 3,000 جنيه",
  "3000+": "أكثر من 3,000 جنيه",
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, character => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });

export function buildBookingEmailContent(booking: Booking) {
  const projectType = projectTypeLabels[booking.projectType];
  const budget = budgetLabels[booking.budget];
  const subject = `طلب حجز جديد ${booking.publicId} — ${booking.name}`;
  const text = [
    "وصل طلب مشروع جديد إلى STRATIX.",
    "",
    `رقم الطلب: ${booking.publicId}`,
    `الاسم: ${booking.name}`,
    `الهاتف: ${booking.phone}`,
    `البريد: ${booking.clientEmail || "غير مضاف"}`,
    `نوع الموقع: ${projectType}`,
    `الميزانية: ${budget}`,
    `وقت الاستلام: ${new Date(booking.createdAt).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}`,
    "",
    "تفاصيل المشروع:",
    booking.details || "لم يضف العميل ملاحظات إضافية.",
  ].join("\n");

  const html = `
    <div dir="rtl" style="max-width:680px;margin:auto;background:#11100f;color:#f4eee4;padding:32px;font-family:Tahoma,Arial,sans-serif">
      <p style="margin:0 0 10px;color:#ff6b1a;font-size:13px;letter-spacing:1px">STRATIX / NEW BOOKING</p>
      <h1 style="margin:0 0 28px;font-size:28px">طلب مشروع جديد</h1>
      <table role="presentation" style="width:100%;border-collapse:collapse;color:#f4eee4">
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">رقم الطلب</td><td style="padding:10px;border-bottom:1px solid #39332e">${escapeHtml(booking.publicId)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">الاسم</td><td style="padding:10px;border-bottom:1px solid #39332e">${escapeHtml(booking.name)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">الهاتف</td><td dir="ltr" style="padding:10px;border-bottom:1px solid #39332e;text-align:right">${escapeHtml(booking.phone)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">البريد</td><td dir="ltr" style="padding:10px;border-bottom:1px solid #39332e;text-align:right">${booking.clientEmail ? escapeHtml(booking.clientEmail) : "غير مضاف"}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">نوع الموقع</td><td style="padding:10px;border-bottom:1px solid #39332e">${projectType}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">الميزانية</td><td style="padding:10px;border-bottom:1px solid #39332e">${budget}</td></tr>
      </table>
      <h2 style="margin:28px 0 10px;font-size:17px;color:#ff6b1a">تفاصيل المشروع</h2>
      <p style="white-space:pre-wrap;line-height:1.9;margin:0">${booking.details ? escapeHtml(booking.details) : "لم يضف العميل ملاحظات إضافية."}</p>
    </div>`;

  return { subject, text, html };
}

// Sends via Resend's HTTPS API instead of raw SMTP. Gmail's SMTP servers
// reject or silently time out connections originating from cloud/datacenter
// IPs (a known anti-abuse behavior, confirmed across two different hosts on
// this project) — an HTTPS API call is just a normal web request, so it
// isn't subject to that SMTP-specific blocking.
export async function sendBookingEmail(booking: Booking): Promise<BookingEmailResult> {
  const apiKey = ENV.resendApiKey.trim();
  const to = ENV.bookingEmailTo.trim();
  const from = ENV.resendFromAddress.trim() || DEFAULT_FROM_ADDRESS;

  if (!apiKey || !to) {
    return { status: "not_configured", error: "Resend configuration is incomplete" };
  }

  try {
    const content = buildBookingEmailContent(booking);
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: booking.clientEmail || undefined,
        subject: content.subject,
        text: content.text,
        html: content.html,
        headers: { "X-STRATIX-Booking-ID": booking.publicId },
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (body && typeof body === "object" && "message" in body && String(body.message)) ||
        `Resend API error (${response.status})`;
      console.error(`[Booking email] Delivery failed for ${booking.publicId}:`, message);
      return { status: "failed", error: message };
    }

    const messageId = body && typeof body === "object" && "id" in body ? String(body.id) : "unknown";
    return { status: "sent", messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Resend API error";
    console.error(`[Booking email] Delivery failed for ${booking.publicId}:`, message);
    return { status: "failed", error: message };
  }
}
