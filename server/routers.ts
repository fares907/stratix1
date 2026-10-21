import { z } from "zod";
import { adminAuthRouter } from "./adminSession";
import { bookingInputSchema, submitBooking } from "./booking";
import { contactInputSchema, submitContactRequest } from "./contact";
import {
  declarePayment,
  getInvoicePdfBase64,
  lookupPayment,
  markPaymentStatus,
  paymentDeclareSchema,
  paymentLookupSchema,
} from "./payment";
import {
  createInvoice,
  createLedgerEntry,
  deleteInvoice,
  deleteLedgerEntry,
  getBookingStats,
  getContactLeadStats,
  getInvoiceStats,
  getLedgerStats,
  listBookings,
  listContactLeads,
  listInvoices,
  listLedgerEntries,
  setBookingAmount,
  setBookingStage,
  updateBookingStatus,
  updateContactLeadStatus,
} from "./db";
import { BOOKING_STAGES } from "../drizzle/schema";
import { trackOrder, trackingLookupSchema } from "./tracking";
import { systemRouter } from "./_core/systemRouter";
import { adminSessionProcedure, publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
  system: systemRouter,

  booking: router({
    submit: publicProcedure
      .input(bookingInputSchema)
      .mutation(({ ctx, input }) => submitBooking(input, ctx.req)),
  }),

  contact: router({
    request: publicProcedure
      .input(contactInputSchema)
      .mutation(({ ctx, input }) => submitContactRequest(input, ctx.req)),
  }),

  payment: router({
    // A mutation rather than a query even though it reads: it is rate-limited
    // and must never be cached or prefetched by the client.
    lookup: publicProcedure
      .input(paymentLookupSchema)
      .mutation(({ ctx, input }) => lookupPayment(input, ctx.req)),

    declare: publicProcedure
      .input(paymentDeclareSchema)
      .mutation(({ input }) => declarePayment(input)),
  }),

  tracking: router({
    // A mutation for the same reason as payment.lookup: rate-limited, and must
    // never be cached or prefetched.
    lookup: publicProcedure
      .input(trackingLookupSchema)
      .mutation(({ ctx, input }) => trackOrder(input, ctx.req)),
  }),

  adminAuth: adminAuthRouter,

  adminBookings: router({
    list: adminSessionProcedure
      .input(
        z.object({
          status: z.enum(["new", "contacted", "closed"]).optional(),
          paymentStatus: z.enum(["unpaid", "awaiting_review", "paid"]).optional(),
          search: z.string().trim().max(64).optional(),
          limit: z.number().int().min(1).max(100).default(25),
          offset: z.number().int().min(0).default(0),
        }),
      )
      .query(({ input }) => listBookings(input)),

    stats: adminSessionProcedure.query(() => getBookingStats()),

    updateStatus: adminSessionProcedure
      .input(z.object({ publicId: z.string(), status: z.enum(["new", "contacted", "closed"]) }))
      .mutation(({ input }) => updateBookingStatus(input)),

    // Quoting a project is what makes its payment page usable — until an amount
    // is set the client is told the quote is not ready.
    setAmount: adminSessionProcedure
      .input(
        z.object({
          publicId: z.string().min(1).max(32),
          amountDue: z.number().positive().max(10_000_000),
          currency: z.enum(["EGP", "USD", "SAR", "AED"]),
        }),
      )
      .mutation(({ input }) =>
        setBookingAmount({
          publicId: input.publicId,
          amountDue: input.amountDue.toFixed(2),
          currency: input.currency,
        }),
      ),

    // Confirming money actually arrived. Only an owner can do this — a client
    // saying they transferred moves the booking to awaiting_review, never paid.
    // Confirming also emails the client their receipt.
    setPaymentStatus: adminSessionProcedure
      .input(
        z.object({
          publicId: z.string().min(1).max(32),
          paymentStatus: z.enum(["unpaid", "awaiting_review", "paid"]),
        }),
      )
      .mutation(({ input }) => markPaymentStatus(input)),

    // Moves the project along the stages the client sees on /track.
    setStage: adminSessionProcedure
      .input(z.object({ publicId: z.string().min(1).max(32), stage: z.enum(BOOKING_STAGES) }))
      .mutation(({ input }) => setBookingStage(input)),

    // The owners' copy of the invoice the client is emailed.
    invoicePdf: adminSessionProcedure
      .input(z.object({ publicId: z.string().min(1).max(32) }))
      .mutation(({ input }) => getInvoicePdfBase64(input.publicId)),
  }),

  adminLedger: router({
    list: adminSessionProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) }))
      .query(({ input }) => listLedgerEntries(input)),

    stats: adminSessionProcedure.query(() => getLedgerStats()),

    create: adminSessionProcedure
      .input(
        z.object({
          type: z.enum(["income", "expense"]),
          amount: z.number().positive().max(10_000_000),
          note: z.string().trim().min(1).max(255),
          occurredAt: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        createLedgerEntry({
          type: input.type,
          amount: input.amount.toFixed(2),
          note: input.note,
          occurredAt: input.occurredAt,
          createdBy: ctx.adminAccount.id,
          createdAt: Date.now(),
        }),
      ),

    remove: adminSessionProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteLedgerEntry(input.id)),
  }),

  adminLeads: router({
    list: adminSessionProcedure
      .input(
        z.object({
          status: z.enum(["new", "contacted", "closed"]).optional(),
          limit: z.number().int().min(1).max(100).default(25),
          offset: z.number().int().min(0).max(1_000_000).default(0),
        }),
      )
      .query(({ input }) => listContactLeads(input)),

    stats: adminSessionProcedure.query(() => getContactLeadStats()),

    setStatus: adminSessionProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["new", "contacted", "closed"]) }))
      .mutation(({ input }) => updateContactLeadStatus(input)),
  }),

  adminInvoices: router({
    list: adminSessionProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) }))
      .query(({ input }) => listInvoices(input)),

    stats: adminSessionProcedure.query(() => getInvoiceStats()),

    create: adminSessionProcedure
      .input(
        z.object({
          category: z.enum(["domain", "hosting", "cloud", "tools", "marketing", "other"]),
          amount: z.number().positive().max(10_000_000),
          currency: z.enum(["USD", "EGP"]),
          note: z.string().trim().min(1).max(255),
          occurredAt: z.number().int().positive(),
        }),
      )
      .mutation(({ ctx, input }) =>
        createInvoice({
          category: input.category,
          amount: input.amount.toFixed(2),
          currency: input.currency,
          note: input.note,
          occurredAt: input.occurredAt,
          createdBy: ctx.adminAccount.id,
          createdAt: Date.now(),
        }),
      ),

    remove: adminSessionProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteInvoice(input.id)),
  }),

});

export type AppRouter = typeof appRouter;
