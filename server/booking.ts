import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./_core/context";
import { notifyOwner } from "./_core/notification";
import {
  createBooking,
  getBookingByRequestKey,
  getRecentBookingSignals,
  updateBookingEmailDelivery,
} from "./db";
import { sendBookingEmail, sendCustomerConfirmationEmail } from "./email";

const egyptianPhone = /^(?:\+20|0)1[0125]\d{8}$/;

export const bookingInputSchema = z.object({
  requestKey: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(2, "اكتب اسماً صحيحاً")
    .max(80, "الاسم أطول من اللازم")
    .regex(/^[A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s.'-]*$/, "الاسم يحتوي على رموز غير مسموحة")
    .transform(value => value.replace(/\s+/g, " ")),
  phone: z
    .string()
    .trim()
    .transform(value => value.replace(/[\s()-]/g, ""))
    .refine(value => egyptianPhone.test(value), "أدخل رقم هاتف مصرياً صحيحاً"),
  clientEmail: z
    .union([z.literal(""), z.string().trim().email("أدخل بريداً إلكترونياً صحيحاً").max(320)])
    .optional()
    .transform(value => value || undefined),
  projectType: z.enum(["company", "personal", "other"]),
  budget: z.enum(["700-1500", "1500-3000", "3000+"]),
  details: z
    .union([z.literal(""), z.string().trim().min(15, "لو هتكتب ملاحظات، خليها 15 حرف على الأقل").max(2000, "الملاحظات أطول من اللازم")])
    .optional()
    .transform(value => value || undefined),
  website: z.string().max(0).optional().default(""),
  language: z.enum(["ar", "en"]).default("ar"),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const BOOKING_LIMITS = {
  windowMs: 60 * 60 * 1000,
  perClient: 5,
  perPhone: 3,
} as const;

function getClientHash(req: TrpcContext["req"]) {
  const address = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  const secret = process.env.JWT_SECRET || "stratix-booking-fingerprint";
  return createHash("sha256").update(`${address}|${userAgent}|${secret}`).digest("hex");
}

function createPublicId() {
  return `STRX-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function submitBooking(input: BookingInput, req: TrpcContext["req"]) {
  const previous = await getBookingByRequestKey(input.requestKey);
  if (previous) {
    return {
      accepted: true,
      publicId: previous.publicId,
      duplicate: true,
      emailSent: previous.emailStatus === "sent",
    } as const;
  }

  const clientHash = getClientHash(req);
  const recent = await getRecentBookingSignals({
    clientHash,
    phone: input.phone,
    since: Date.now() - BOOKING_LIMITS.windowMs,
  });

  if (recent.byClient >= BOOKING_LIMITS.perClient || recent.byPhone >= BOOKING_LIMITS.perPhone) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "تم استلام عدة طلبات مؤخراً. حاول مرة أخرى بعد قليل أو اتصل بنا مباشرة.",
    });
  }

  const now = Date.now();
  let booking;
  try {
    booking = await createBooking({
      publicId: createPublicId(),
      requestKey: input.requestKey,
      clientHash,
      name: input.name,
      phone: input.phone,
      clientEmail: input.clientEmail ?? null,
      projectType: input.projectType,
      budget: input.budget,
      details: input.details ?? "",
      status: "new",
      emailStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    const duplicate = await getBookingByRequestKey(input.requestKey);
    if (duplicate) {
      return {
        accepted: true,
        publicId: duplicate.publicId,
        duplicate: true,
        emailSent: duplicate.emailStatus === "sent",
      } as const;
    }
    console.error("[Booking] Database write failed:", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ الطلب الآن. حاول مرة أخرى." });
  }

  const email = await sendBookingEmail(booking);
  await updateBookingEmailDelivery({
    publicId: booking.publicId,
    status: email.status,
    messageId: email.status === "sent" ? email.messageId : undefined,
    error: email.status === "sent" ? undefined : email.error,
  });

  if (email.status !== "sent") {
    await notifyOwner({
      title: `حجز STRATIX جديد — ${booking.publicId}`,
      content: `${booking.name}\n${booking.phone}\n${booking.details}`,
    }).catch(error => console.warn("[Booking] Owner notification fallback failed:", error));
  }

  if (booking.clientEmail) {
    await sendCustomerConfirmationEmail(booking, input.language).catch(error =>
      console.warn("[Booking] Customer confirmation email failed:", error),
    );
  }

  return {
    accepted: true,
    publicId: booking.publicId,
    duplicate: false,
    emailSent: email.status === "sent",
  } as const;
}
