import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { normalizePhone } from "./booking";
import type { TrpcContext } from "./_core/context";
import { clientIp } from "./_core/origin";
import { createWindowLimiter } from "./_core/windowLimiter";
import { sendContactLeadEmail } from "./email";

// A lighter sibling of the booking form: the chat "talk to us" handoff. The
// visitor picks what they need and leaves a phone number, and the owners get an
// email lead they can act on. No database row — this is a notification, not a
// tracked order, and it must not turn into a second write path to maintain.
export const contactInputSchema = z.object({
  topic: z.enum(["new_site", "existing_issue", "other"]),
  phone: z
    .string()
    .trim()
    .max(32, "رقم الهاتف أطول من اللازم")
    .transform((value, ctx) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "أدخل رقم هاتف صحيحاً مع كود الدولة" });
        return z.NEVER;
      }
      return normalized;
    }),
  clientEmail: z
    .union([z.literal(""), z.string().trim().email("أدخل بريداً إلكترونياً صحيحاً").max(320)])
    .optional()
    .transform(value => value || undefined),
  note: z
    .union([z.literal(""), z.string().trim().max(500)])
    .optional()
    .transform(value => value || undefined),
  // Honeypot: a real person never fills this. A bot that autofills every field
  // does, and gets silently dropped.
  website: z.string().max(0).optional().default(""),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

// Same shape of defence as the booking form. The chat handoff is unauthenticated
// and could be scripted, so a global counter that keys on nothing the client
// controls caps how many leads can be pushed per window regardless of rotated
// headers. The threshold is generous enough never to block real visitors.
const GLOBAL_CONTACT_WINDOW_MS = 10 * 60 * 1000;
const GLOBAL_CONTACT_MAX = 40;
let globalContact = { count: 0, windowStart: 0 };

function isGlobalContactRateLimited() {
  const now = Date.now();
  if (now - globalContact.windowStart > GLOBAL_CONTACT_WINDOW_MS) return false;
  return globalContact.count >= GLOBAL_CONTACT_MAX;
}

function recordGlobalContact() {
  const now = Date.now();
  if (now - globalContact.windowStart > GLOBAL_CONTACT_WINDOW_MS) {
    globalContact = { count: 1, windowStart: now };
    return;
  }
  globalContact.count += 1;
}

// Checked before the global ceiling, so one visitor flooding the form is stopped
// on their own and cannot spend the allowance that real visitors share.
const perVisitor = createWindowLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

export async function submitContactRequest(input: ContactInput, req: TrpcContext["req"]) {
  // Drop bots that filled the honeypot, but return success so they get no signal
  // that they were caught.
  if (input.website) {
    return { accepted: true } as const;
  }

  const visitor = clientIp(req);
  if (perVisitor.isLimited(visitor)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "تم استلام عدة طلبات مؤخراً. حاول مرة أخرى بعد قليل أو اتصل بنا مباشرة.",
    });
  }
  perVisitor.record(visitor);

  if (isGlobalContactRateLimited()) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "تم استلام عدة طلبات مؤخراً. حاول مرة أخرى بعد قليل أو اتصل بنا مباشرة.",
    });
  }

  recordGlobalContact();

  const email = await sendContactLeadEmail({
    topic: input.topic,
    phone: input.phone,
    clientEmail: input.clientEmail,
    note: input.note,
  });

  // Leads are not stored in the database, so when the email fails the server log
  // is the only copy left — it carries the details needed to call them back.
  if (email.status !== "sent") {
    console.error(
      `[Contact] Lead email not delivered (${email.error}). topic=${input.topic} phone=${input.phone} email=${input.clientEmail ?? "-"}`,
    );
  }

  return { accepted: true, delivered: email.status === "sent" } as const;
}
