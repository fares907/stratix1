import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { normalizePhone } from "./booking";
import { declareBookingPayment, getBookingForPayment } from "./db";
import { ENV } from "./_core/env";
import { sendPaymentDeclaredEmail } from "./email";
import { notifyOwner } from "./_core/notification";

// Payment is settled outside this application. The client transfers by InstaPay
// or bank transfer and an owner confirms the money arrived. Nothing here touches
// a card, a gateway, or a bank API — the app only tells the client what to send
// and records that they say they sent it.

export const paymentLookupSchema = z.object({
  publicId: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .transform(value => value.toUpperCase()),
  phone: z
    .string()
    .trim()
    .max(32)
    .transform((value, ctx) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "أدخل رقم هاتف صحيحاً مع كود الدولة" });
        return z.NEVER;
      }
      return normalized;
    }),
});

export const paymentDeclareSchema = paymentLookupSchema.extend({
  reference: z.string().trim().min(3, "اكتب رقم عملية التحويل").max(120),
});

// The lookup is unauthenticated and returns a customer's name and the amount
// they owe, so it is the one endpoint worth brute-forcing. Order ids are random
// 10-hex-character strings, but a global ceiling means an attacker cannot grind
// through the space no matter how many addresses they rotate through. Well
// above what a real client needs: a person checking their own order makes a
// handful of attempts, not hundreds.
const LOOKUP_WINDOW_MS = 10 * 60 * 1000;
const LOOKUP_MAX_ATTEMPTS = 60;
let lookupWindow = { count: 0, windowStart: 0 };

function isLookupRateLimited() {
  const now = Date.now();
  if (now - lookupWindow.windowStart > LOOKUP_WINDOW_MS) return false;
  return lookupWindow.count >= LOOKUP_MAX_ATTEMPTS;
}

function recordLookup() {
  const now = Date.now();
  if (now - lookupWindow.windowStart > LOOKUP_WINDOW_MS) {
    lookupWindow = { count: 1, windowStart: now };
    return;
  }
  lookupWindow.count += 1;
}

const NOT_FOUND_MESSAGE =
  "لم نجد طلباً بهذا الرقم مرتبطاً بهذا الهاتف. راجع البيانات أو تواصل معنا.";

/** Payment destinations shown to a verified client. Empty ones are omitted. */
export function getPaymentMethods() {
  return {
    instapay: ENV.paymentInstapay.trim(),
    iban: ENV.paymentIban.trim(),
    bankName: ENV.paymentBankName.trim(),
    accountName: ENV.paymentAccountName.trim(),
  };
}

export type PaymentLookupInput = z.infer<typeof paymentLookupSchema>;
export type PaymentDeclareInput = z.infer<typeof paymentDeclareSchema>;

export async function lookupPayment(input: PaymentLookupInput) {
  if (isLookupRateLimited()) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "محاولات كثيرة. حاول بعد قليل أو تواصل معنا مباشرة.",
    });
  }
  recordLookup();

  const booking = await getBookingForPayment(input);
  // Deliberately identical whether the order id is wrong, the phone is wrong, or
  // neither exists — a distinct "order found, wrong phone" would confirm which
  // ids are real.
  if (!booking) {
    throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND_MESSAGE });
  }

  const methods = getPaymentMethods();

  return {
    publicId: booking.publicId,
    name: booking.name,
    // Null until an owner quotes the project; the page shows "quote not ready"
    // rather than inviting a payment of zero.
    amountDue: booking.amountDue,
    currency: booking.currency,
    paymentStatus: booking.paymentStatus,
    methods: booking.amountDue ? methods : null,
  } as const;
}

export async function declarePayment(input: PaymentDeclareInput) {
  const booking = await getBookingForPayment({ publicId: input.publicId, phone: input.phone });
  if (!booking) {
    throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND_MESSAGE });
  }

  if (!booking.amountDue) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "لم يتم تحديد مبلغ لهذا الطلب بعد. تواصل معنا أولاً.",
    });
  }

  // Confirming twice is harmless but must not spam the owners with a second
  // email or reopen a payment they already verified.
  if (booking.paymentStatus === "paid") {
    return { accepted: true, alreadyPaid: true } as const;
  }

  await declareBookingPayment({ publicId: booking.publicId, reference: input.reference });

  const email = await sendPaymentDeclaredEmail({
    publicId: booking.publicId,
    name: booking.name,
    phone: booking.phone,
    amountDue: booking.amountDue,
    currency: booking.currency,
    reference: input.reference,
  });

  if (email.status !== "sent") {
    await notifyOwner({
      title: `تأكيد تحويل — ${booking.publicId}`,
      content: `${booking.name}\n${booking.phone}\nالمبلغ: ${booking.amountDue} ${booking.currency}\nمرجع: ${input.reference}`,
    }).catch(error => console.warn("[Payment] Owner notification fallback failed:", error));
  }

  return { accepted: true, alreadyPaid: false } as const;
}
