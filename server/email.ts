import { resolve4 } from "node:dns/promises";
import type { Booking } from "../drizzle/schema";
import nodemailer from "nodemailer";
import { ENV } from "./_core/env";

const GMAIL_SMTP_HOST = "smtp.gmail.com";

// Some hosts (e.g. Render's free tier) report IPv6 as available on their local
// network interfaces, which is enough for nodemailer to prefer an AAAA record
// for smtp.gmail.com — but outbound IPv6 routing is actually broken there, so
// the connection fails with ENETUNREACH. Resolving the A record ourselves and
// connecting to that literal IPv4 address sidesteps nodemailer's family
// detection entirely. `servername` keeps TLS certificate validation working
// against the real hostname despite connecting via IP.
async function resolveGmailSmtpHost(): Promise<string> {
  try {
    const [address] = await resolve4(GMAIL_SMTP_HOST);
    return address || GMAIL_SMTP_HOST;
  } catch {
    return GMAIL_SMTP_HOST;
  }
}

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

export async function sendBookingEmail(booking: Booking): Promise<BookingEmailResult> {
  const user = ENV.gmailSmtpUser.trim();
  const pass = ENV.gmailAppPassword.replace(/\s+/g, "");
  const to = ENV.bookingEmailTo.trim() || user;

  if (!user || !pass || !to) {
    return { status: "not_configured", error: "Gmail SMTP configuration is incomplete" };
  }

  const transporter = nodemailer.createTransport({
    host: await resolveGmailSmtpHost(),
    port: 465,
    secure: true,
    tls: { servername: GMAIL_SMTP_HOST },
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    const content = buildBookingEmailContent(booking);
    const info = await transporter.sendMail({
      from: `STRATIX <${user}>`,
      to,
      replyTo: booking.clientEmail || undefined,
      ...content,
      headers: { "X-STRATIX-Booking-ID": booking.publicId },
    });
    return { status: "sent", messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    console.error(`[Booking email] Delivery failed for ${booking.publicId}:`, message);
    return { status: "failed", error: message };
  } finally {
    transporter.close();
  }
}
