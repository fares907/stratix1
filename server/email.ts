import type { Booking } from "../drizzle/schema";
import { ENV } from "./_core/env";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_ADDRESS = "STRATIX <onboarding@resend.dev>";

export type BookingEmailResult =
  | { status: "sent"; messageId: string }
  | { status: "failed" | "not_configured"; error: string };

export type CustomerLanguage = "ar" | "en";

const projectTypeLabels: Record<Booking["projectType"], string> = {
  company: "موقع شركة",
  personal: "موقع شخصي",
  other: "فكرة أخرى",
};

// Legacy price-band identifiers, relabelled as project sizes: the site no
// longer publishes prices and the form now asks about scope instead.
const budgetLabels: Record<Booking["budget"], string> = {
  "700-1500": "موقع بسيط — صفحة واحدة",
  "1500-3000": "موقع متعدد الصفحات",
  "3000+": "متجر أو نظام كبير",
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

const customerConfirmationCopy = {
  ar: {
    dir: "rtl" as const,
    eyebrow: "STRATIX / تأكيد الاستلام",
    subject: (publicId: string) => `تم استلام طلبك — ${publicId}`,
    heading: (name: string) => `أهلاً ${name}،`,
    body: (publicId: string) =>
      `وصلنا طلبك بنجاح ورقمه ${publicId}. هنراجع التفاصيل ونتواصل معك قريباً لتأكيد السعر والخطوات التالية.`,
    footer: "لو عندك أي سؤال، تقدر تتواصل معنا على 01125839109 أو 01036678093 (متاحون على واتساب كمان).",
    thanks: "شكراً لثقتك في STRATIX.",
  },
  en: {
    dir: "ltr" as const,
    eyebrow: "STRATIX / Request Received",
    subject: (publicId: string) => `We received your request — ${publicId}`,
    heading: (name: string) => `Hi ${name},`,
    body: (publicId: string) =>
      `We've received your request (order #${publicId}). We'll review the details and reach out soon to confirm the price and next steps.`,
    footer: "If you have any questions, reach us at 01125839109 or 01036678093 (also available on WhatsApp).",
    thanks: "Thanks for choosing STRATIX.",
  },
};

export function buildCustomerConfirmationContent(booking: Booking, language: CustomerLanguage) {
  const copy = customerConfirmationCopy[language];
  const subject = copy.subject(booking.publicId);
  const text = [copy.heading(booking.name), "", copy.body(booking.publicId), "", copy.footer, copy.thanks].join("\n");

  const html = `
    <div dir="${copy.dir}" style="max-width:560px;margin:auto;background:#11100f;color:#f4eee4;padding:32px;font-family:Tahoma,Arial,sans-serif">
      <p style="margin:0 0 10px;color:#ff6b1a;font-size:13px;letter-spacing:1px">${copy.eyebrow}</p>
      <h1 style="margin:0 0 20px;font-size:24px">${escapeHtml(copy.heading(booking.name))}</h1>
      <p style="line-height:1.9;margin:0 0 18px">${escapeHtml(copy.body(booking.publicId))}</p>
      <p style="line-height:1.9;margin:0 0 18px;color:#aaa099">${escapeHtml(copy.footer)}</p>
      <p style="line-height:1.9;margin:0">${escapeHtml(copy.thanks)}</p>
    </div>`;

  return { subject, text, html };
}

async function sendViaResend(params: {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  publicId: string;
}): Promise<BookingEmailResult> {
  const apiKey = ENV.resendApiKey.trim();
  const from = ENV.resendFromAddress.trim() || DEFAULT_FROM_ADDRESS;

  if (!apiKey || !params.to) {
    return { status: "not_configured", error: "Resend configuration is incomplete" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        reply_to: params.replyTo || undefined,
        subject: params.subject,
        text: params.text,
        html: params.html,
        headers: { "X-STRATIX-Booking-ID": params.publicId },
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (body && typeof body === "object" && "message" in body && String(body.message)) ||
        `Resend API error (${response.status})`;
      console.error(`[Email] Delivery failed for ${params.publicId}:`, message);
      return { status: "failed", error: message };
    }

    const messageId = body && typeof body === "object" && "id" in body ? String(body.id) : "unknown";
    return { status: "sent", messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Resend API error";
    console.error(`[Email] Delivery failed for ${params.publicId}:`, message);
    return { status: "failed", error: message };
  }
}

// Sends via Resend's HTTPS API instead of raw SMTP. Gmail's SMTP servers
// reject or silently time out connections originating from cloud/datacenter
// IPs (a known anti-abuse behavior, confirmed across two different hosts on
// this project) — an HTTPS API call is just a normal web request, so it
// isn't subject to that SMTP-specific blocking.
export async function sendBookingEmail(booking: Booking): Promise<BookingEmailResult> {
  const to = ENV.bookingEmailTo.trim();
  const content = buildBookingEmailContent(booking);
  return sendViaResend({
    to,
    replyTo: booking.clientEmail || undefined,
    publicId: booking.publicId,
    ...content,
  });
}

const contactTopicLabels: Record<"new_site" | "existing_issue" | "other", string> = {
  new_site: "عايز يعمل موقع جديد",
  existing_issue: "عنده مشكلة في موقع قائم",
  other: "استفسار / تواصل",
};

// A lead captured from the site chat's "talk to us" flow. Delivered to the same
// owner inbox as bookings so both land in one place, and marked in the subject
// so it's distinguishable at a glance from a full booking.
export async function sendContactLeadEmail(lead: {
  topic: "new_site" | "existing_issue" | "other";
  phone: string;
  clientEmail?: string;
  note?: string;
}): Promise<BookingEmailResult> {
  const to = ENV.bookingEmailTo.trim();
  const topic = contactTopicLabels[lead.topic];
  const receivedAt = new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });

  const subject = `طلب تواصل من الشات — ${topic}`;
  const text = [
    "وصل طلب تواصل جديد من الشات على موقع STRATIX.",
    "",
    `نوع الطلب: ${topic}`,
    `رقم العميل: ${lead.phone}`,
    `البريد: ${lead.clientEmail || "غير مضاف"}`,
    lead.note ? `ملاحظة: ${lead.note}` : "",
    `وقت الاستلام: ${receivedAt}`,
    "",
    "كلّم العميل في أقرب وقت.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div dir="rtl" style="max-width:680px;margin:auto;background:#11100f;color:#f4eee4;padding:32px;font-family:Tahoma,Arial,sans-serif">
      <p style="margin:0 0 10px;color:#ff6b1a;font-size:13px;letter-spacing:1px">STRATIX / CHAT LEAD</p>
      <h1 style="margin:0 0 24px;font-size:26px">طلب تواصل جديد</h1>
      <table role="presentation" style="width:100%;border-collapse:collapse;color:#f4eee4">
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">نوع الطلب</td><td style="padding:10px;border-bottom:1px solid #39332e">${escapeHtml(topic)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">رقم العميل</td><td dir="ltr" style="padding:10px;border-bottom:1px solid #39332e;text-align:right">${escapeHtml(lead.phone)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">البريد</td><td dir="ltr" style="padding:10px;border-bottom:1px solid #39332e;text-align:right">${lead.clientEmail ? escapeHtml(lead.clientEmail) : "غير مضاف"}</td></tr>
        ${lead.note ? `<tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">ملاحظة</td><td style="padding:10px;border-bottom:1px solid #39332e">${escapeHtml(lead.note)}</td></tr>` : ""}
      </table>
      <p style="margin:24px 0 0;color:#aaa099;font-size:13px">وقت الاستلام: ${escapeHtml(receivedAt)}</p>
    </div>`;

  return sendViaResend({
    to,
    replyTo: lead.clientEmail || undefined,
    publicId: `chat-${Date.now()}`,
    subject,
    text,
    html,
  });
}

// Sent when a client states they have transferred. The wording is deliberately
// "says they transferred", not "has paid" — the money still has to be confirmed
// in the account before the booking is marked paid.
export async function sendPaymentDeclaredEmail(payment: {
  publicId: string;
  name: string;
  phone: string;
  amountDue: string;
  currency: string;
  reference: string;
}): Promise<BookingEmailResult> {
  const to = ENV.bookingEmailTo.trim();
  const receivedAt = new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });
  const amount = `${payment.amountDue} ${payment.currency}`;

  const subject = `تأكيد تحويل — ${payment.publicId} — ${amount}`;
  const text = [
    "عميل أكد أنه حوّل مبلغ الطلب.",
    "",
    `رقم الطلب: ${payment.publicId}`,
    `الاسم: ${payment.name}`,
    `الهاتف: ${payment.phone}`,
    `المبلغ المطلوب: ${amount}`,
    `مرجع التحويل: ${payment.reference}`,
    `وقت التأكيد: ${receivedAt}`,
    "",
    "راجع الحساب البنكي أو InstaPay، وبعد التأكد علّم الطلب كمدفوع من لوحة التحكم.",
  ].join("\n");

  const html = `
    <div dir="rtl" style="max-width:680px;margin:auto;background:#11100f;color:#f4eee4;padding:32px;font-family:Tahoma,Arial,sans-serif">
      <p style="margin:0 0 10px;color:#ff6b1a;font-size:13px;letter-spacing:1px">STRATIX / PAYMENT DECLARED</p>
      <h1 style="margin:0 0 24px;font-size:26px">عميل أكد التحويل</h1>
      <table role="presentation" style="width:100%;border-collapse:collapse;color:#f4eee4">
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">رقم الطلب</td><td style="padding:10px;border-bottom:1px solid #39332e">${escapeHtml(payment.publicId)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">الاسم</td><td style="padding:10px;border-bottom:1px solid #39332e">${escapeHtml(payment.name)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">الهاتف</td><td dir="ltr" style="padding:10px;border-bottom:1px solid #39332e;text-align:right">${escapeHtml(payment.phone)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">المبلغ</td><td dir="ltr" style="padding:10px;border-bottom:1px solid #39332e;text-align:right">${escapeHtml(amount)}</td></tr>
        <tr><td style="padding:10px;border-bottom:1px solid #39332e;color:#aaa099">مرجع التحويل</td><td dir="ltr" style="padding:10px;border-bottom:1px solid #39332e;text-align:right">${escapeHtml(payment.reference)}</td></tr>
      </table>
      <p style="margin:24px 0 0;line-height:1.9;color:#ffb27a">
        ⚠️ ده تأكيد من العميل وليس إثباتاً. راجع وصول المبلغ فعلياً قبل أن تعلّم الطلب كمدفوع.
      </p>
      <p style="margin:12px 0 0;color:#aaa099;font-size:13px">وقت التأكيد: ${escapeHtml(receivedAt)}</p>
    </div>`;

  return sendViaResend({ to, publicId: payment.publicId, subject, text, html });
}

// Best-effort confirmation to the customer, only sent when they provided an
// email. Failures here never affect booking.submit's own success response —
// the owner notification above is the one that must succeed.
export async function sendCustomerConfirmationEmail(
  booking: Booking,
  language: CustomerLanguage,
): Promise<BookingEmailResult> {
  if (!booking.clientEmail) {
    return { status: "not_configured", error: "Customer did not provide an email" };
  }

  const content = buildCustomerConfirmationContent(booking, language);
  return sendViaResend({
    to: booking.clientEmail,
    publicId: booking.publicId,
    ...content,
  });
}
