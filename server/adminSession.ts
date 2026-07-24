import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  clearAdminSessionCookie,
  clearLoginAttempts,
  createAdminSessionToken,
  getAdminAccountFromRequest,
  isLoginRateLimited,
  recordLoginAttempt,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "./_core/adminAuth";
import type { TrpcContext } from "./_core/context";
import { publicProcedure, router } from "./_core/trpc";

function getRequestIp(req: TrpcContext["req"]) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export const adminAuthRouter = router({
  me: publicProcedure.query(async ({ ctx }) => getAdminAccountFromRequest(ctx.req)),

  login: publicProcedure
    .input(z.object({ accountId: z.enum(["fares", "youssef"]), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const ip = getRequestIp(ctx.req);

      if (isLoginRateLimited(ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "محاولات دخول كثيرة. حاول مرة أخرى بعد قليل.",
        });
      }

      const account = verifyAdminCredentials(input.accountId, input.password);
      if (!account) {
        recordLoginAttempt(ip);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة." });
      }

      clearLoginAttempts(ip);
      const token = await createAdminSessionToken(account);
      setAdminSessionCookie(ctx.req, ctx.res, token);
      return account;
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearAdminSessionCookie(ctx.req, ctx.res);
    return { success: true } as const;
  }),
});
