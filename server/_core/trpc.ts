import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getAdminAccountFromRequest } from "./adminAuth";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Separate, self-contained session for the STRATIX bookings dashboard
// (fares/youssef password login), independent of the OAuth user above.
// Deliberately uses its own error message (not UNAUTHED_ERR_MSG) — the client
// treats that exact string as a signal to redirect into the OAuth flow, which
// this dashboard does not use.
export const adminSessionProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const adminAccount = await getAdminAccountFromRequest(ctx.req);
    if (!adminAccount) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "STRATIX admin session required" });
    }

    return next({
      ctx: {
        ...ctx,
        adminAccount,
      },
    });
  }),
);
