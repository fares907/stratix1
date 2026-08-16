import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { adminAuthRouter } from "./adminSession";
import { bookingInputSchema, submitBooking } from "./booking";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  createInvoice,
  createLedgerEntry,
  deleteBooking,
  deleteInvoice,
  deleteLedgerEntry,
  getBookingStats,
  getInvoiceStats,
  getLedgerStats,
  listBookings,
  listInvoices,
  listLedgerEntries,
  updateBookingStatus,
} from "./db";
import { systemRouter } from "./_core/systemRouter";
import { adminSessionProcedure, publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  booking: router({
    submit: publicProcedure
      .input(bookingInputSchema)
      .mutation(({ ctx, input }) => submitBooking(input, ctx.req)),
  }),

  adminAuth: adminAuthRouter,

  adminBookings: router({
    list: adminSessionProcedure
      .input(
        z.object({
          status: z.enum(["new", "contacted", "closed"]).optional(),
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

    remove: adminSessionProcedure
      .input(z.object({ publicId: z.string().min(1).max(32) }))
      .mutation(({ input }) => deleteBooking(input.publicId)),
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
