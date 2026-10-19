import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { authenticateAdmin } from "./adminAuth";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// The only authenticated surface: the bookings dashboard's password login for
// the two owners.
export const adminSessionProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const adminAccount = await authenticateAdmin(ctx.req, ctx.res);
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
