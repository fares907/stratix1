import { afterEach, describe, expect, it, vi } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpAt, verifyTotp } from "./_core/totp";

// RFC 6238 Appendix B, SHA-1 column. The reference secret is the ASCII string
// "12345678901234567890"; the RFC prints 8-digit codes, of which a 6-digit
// authenticator shows the last six.
const RFC_KEY = Buffer.from("12345678901234567890");
const RFC_VECTORS: Array<[number, string]> = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("TOTP", () => {
  it("matches every RFC 6238 SHA-1 test vector", () => {
    for (const [seconds, expected] of RFC_VECTORS) {
      expect(totpAt(RFC_KEY, Math.floor(seconds / 30), 8)).toBe(expected);
      expect(totpAt(RFC_KEY, Math.floor(seconds / 30))).toBe(expected.slice(-6));
    }
  });

  it("round-trips base32 and generates 160-bit secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)?.length).toBe(20);
    expect(base32Encode(base32Decode("JBSWY3DPEHPK3PXP")!)).toBe("JBSWY3DPEHPK3PXP");
    expect(base32Decode("not base32!")).toBeNull();
  });

  it("accepts one step of clock drift and nothing further", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(RFC_KEY, totpAt(RFC_KEY, step), now)).toBe(step);
    expect(verifyTotp(RFC_KEY, totpAt(RFC_KEY, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_KEY, totpAt(RFC_KEY, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC_KEY, totpAt(RFC_KEY, step - 2), now)).toBeNull();
    expect(verifyTotp(RFC_KEY, "12345", now)).toBeNull();
    expect(verifyTotp(RFC_KEY, "abcdef", now)).toBeNull();
  });
});

const SECRET = "a".repeat(48);
const TOTP_SECRET = base32Encode(Buffer.from("12345678901234567890"));

async function loadAuth() {
  vi.resetModules();
  return import("./_core/adminAuth");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("admin two-factor sign-in", () => {
  it("requires a valid code once a secret is configured", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD_FARES", "correct-horse-battery");
    vi.stubEnv("ADMIN_TOTP_SECRET_FARES", TOTP_SECRET);
    const auth = await loadAuth();
    const now = 1_700_000_000_000;
    const code = totpAt(RFC_KEY, Math.floor(now / 30_000));

    expect(auth.verifyAdminCredentials("fares", "correct-horse-battery", "", now)).toBeNull();
    expect(auth.verifyAdminCredentials("fares", "correct-horse-battery", "000000", now)).toBeNull();
    expect(auth.verifyAdminCredentials("fares", "wrong", code, now)).toBeNull();
    expect(auth.verifyAdminCredentials("fares", "correct-horse-battery", code, now)).toEqual({
      id: "fares",
      name: "فارس سامي",
    });
  });

  // A code stays valid for ~90 seconds, so one seen over a shoulder or in a
  // screen recording must not open a second session.
  it("refuses to accept the same code twice", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD_FARES", "correct-horse-battery");
    vi.stubEnv("ADMIN_TOTP_SECRET_FARES", TOTP_SECRET);
    const auth = await loadAuth();
    const now = 1_700_000_000_000;
    const code = totpAt(RFC_KEY, Math.floor(now / 30_000));

    expect(auth.verifyAdminCredentials("fares", "correct-horse-battery", code, now)).not.toBeNull();
    expect(auth.verifyAdminCredentials("fares", "correct-horse-battery", code, now + 5_000)).toBeNull();
  });

  it("blocks sign-in rather than dropping to password-only when the secret is malformed", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD_FARES", "correct-horse-battery");
    vi.stubEnv("ADMIN_TOTP_SECRET_FARES", "not-a-secret!");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = await loadAuth();

    expect(auth.verifyAdminCredentials("fares", "correct-horse-battery")).toBeNull();
    errors.mockRestore();
  });

  it("leaves an account without a secret on password-only", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD_YOUSSEF", "another-strong-one");
    vi.stubEnv("ADMIN_TOTP_SECRET_FARES", TOTP_SECRET);
    const auth = await loadAuth();

    expect(auth.verifyAdminCredentials("youssef", "another-strong-one")).not.toBeNull();
  });
});

function fakeExchange(cookie?: string) {
  const set: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const req = { headers: { cookie }, protocol: "https" } as never;
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => set.push({ name, value, options }),
  } as never;
  return { req, res, set };
}

describe("admin sessions", () => {
  it("rejects a token without the expected issuer and audience", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    const auth = await loadAuth();
    const { SignJWT } = await import("jose");
    const now = Math.floor(Date.now() / 1000);

    const foreign = await new SignJWT({ id: "fares", name: "x", auth_time: now })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode(SECRET));

    expect(await auth.verifyAdminSessionToken(foreign)).toBeNull();
  });

  it("slides the session forward while it is in use", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    const auth = await loadAuth();
    const token = await auth.createAdminSessionToken({ id: "fares", name: "فارس سامي" });

    const fresh = fakeExchange(`${auth.ADMIN_SESSION_COOKIE}=${token}`);
    expect(await auth.authenticateAdmin(fresh.req, fresh.res)).toEqual({ id: "fares", name: "فارس سامي" });
    expect(fresh.set).toHaveLength(0);

    vi.setSystemTime(1_700_000_000_000 + 20 * 60 * 1000);
    const later = fakeExchange(`${auth.ADMIN_SESSION_COOKIE}=${token}`);
    expect(await auth.authenticateAdmin(later.req, later.res)).not.toBeNull();
    expect(later.set).toHaveLength(1);
    expect(later.set[0].options).toMatchObject({ httpOnly: true, sameSite: "strict", secure: true });
  });

  it("ends every session 7 days after sign-in, however actively it was used", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    const signIn = 1_700_000_000_000;
    vi.useFakeTimers({ now: signIn + 7 * 24 * 60 * 60 * 1000 + 60_000 });
    const auth = await loadAuth();
    const token = await auth.createAdminSessionToken({ id: "fares", name: "فارس سامي" }, signIn);

    const exchange = fakeExchange(`${auth.ADMIN_SESSION_COOKIE}=${token}`);
    expect(await auth.authenticateAdmin(exchange.req, exchange.res)).toBeNull();
  });
});
