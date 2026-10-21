import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";
import { clientIp } from "./_core/origin";
import { createWindowLimiter } from "./_core/windowLimiter";
import { getBookingForPayment } from "./db";
import { type PaymentLookupInput, paymentLookupSchema } from "./payment";

// The public order-tracking page. A client proves the order is theirs the same
// way the payment page asks: order number AND the phone it was booked with.
// Either alone would let anyone step through order numbers.
export const trackingLookupSchema = paymentLookupSchema;

const WINDOW_MS = 10 * 60 * 1000;
const perVisitor = createWindowLimiter({ windowMs: WINDOW_MS, max: 10 });
// A ceiling no rotation of addresses can split: order ids are 40 random bits,
// so grinding them needs volume, and this caps the volume.
const everyone = createWindowLimiter({ windowMs: WINDOW_MS, max: 120 });

const NOT_FOUND =
  "لم نجد طلباً بهذا الرقم مرتبطاً بهذا الهاتف. راجع البيانات أو تواصل معنا.";

export async function trackOrder(input: PaymentLookupInput, req?: TrpcContext["req"]) {
  const visitor = req ? clientIp(req) : "unknown";
  if (perVisitor.isLimited(visitor) || everyone.isLimited("all")) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "محاولات كثيرة. حاول بعد قليل أو تواصل معنا مباشرة.",
    });
  }
  perVisitor.record(visitor);
  everyone.record("all");

  const booking = await getBookingForPayment(input);
  // Identical whether the id or the phone is wrong, so a probe learns nothing
  // about which order numbers exist.
  if (!booking) {
    throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND });
  }

  // Only what the client needs to follow their project — no contact details,
  // no internal notes, no sales status.
  return {
    publicId: booking.publicId,
    name: booking.name,
    stage: booking.stage,
    stageUpdatedAt: booking.stageUpdatedAt,
    createdAt: booking.createdAt,
    paymentStatus: booking.paymentStatus,
    amountDue: booking.amountDue,
    currency: booking.currency,
  } as const;
}
