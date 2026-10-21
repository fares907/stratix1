import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  authenticateAdmin,
  clearAdminSessionCookie,
  clearLoginAttempts,
  createAdminSessionToken,
  isLoginRateLimited,
  recordLoginAttempt,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "./_core/adminAuth";
import { clientIp } from "./_core/origin";
import { publicProcedure, router } from "./_core/trpc";

export const adminAuthRouter = router({
  me: publicProcedure.query(({ ctx }) => authenticateAdmin(ctx.req, ctx.res)),

  login: publicProcedure
    .input(
      z.object({
        accountId: z.enum(["fares", "youssef"]).optional(),
        password: z.string().min(1).max(256),
        code: z.string().trim().max(6).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ip = clientIp(ctx.req);

      if (isLoginRateLimited(ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "محاولات دخول كثيرة. حاول مرة أخرى بعد قليل.",
        });
      }

      // One message for a wrong password and a wrong code alike, so a failed
      // attempt never confirms that the password half was right.
      const account = verifyAdminCredentials(input.accountId, input.password, input.code);
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
