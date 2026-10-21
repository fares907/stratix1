import { createHash, timingSafeEqual } from "node:crypto";
import { parseCookie } from "cookie";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";
import { base32Decode, verifyTotp } from "./totp";

export const ADMIN_SESSION_COOKIE = "stratix_admin_session";

// Sessions are bearer cookies with no server-side revocation list, so lifetime
// is the only thing limiting a stolen cookie. Each token lives 12 hours and is
// reissued while the dashboard is in use, so a cookie left on an abandoned
// device dies overnight; no session outlives 7 days from the actual login.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_REFRESH_AFTER_MS = 15 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const JWT_ISSUER = "stratix.website";
const JWT_AUDIENCE = "stratix-admin";

export type AdminAccount = { id: "admin"; name: string };

// One company account: the dashboard presents STRATIX, not the people behind it.
export const ADMIN_DISPLAY_NAME = "STRATIX Management";
const ADMIN: AdminAccount = { id: "admin", name: ADMIN_DISPLAY_NAME };

// A code is valid for about 90 seconds (one step of drift either side), so
// without this anyone who saw it — over a shoulder, in a screen recording —
// could reuse it within that window. Each step is accepted once.
let lastTotpStep = -1;

// A configured but malformed secret must not quietly downgrade sign-in to
// password-only. Sign-in fails until the secret is fixed.
type SecondFactor = { kind: "none" } | { kind: "totp"; key: Buffer } | { kind: "broken" };

function secondFactor(): SecondFactor {
  const raw = ENV.adminTotpSecret.trim();
  if (!raw) return { kind: "none" };
  const key = base32Decode(raw);
  if (!key || key.length < 10) {
    console.error("[Admin] ADMIN_TOTP_SECRET is malformed; sign-in is blocked until it is fixed.");
    return { kind: "broken" };
  }
  return { kind: "totp", key };
}

// This used to fall back to a constant string when JWT_SECRET was unset, which
// meant a missing environment variable silently signed admin sessions with a
// value anyone could read in the public repository and replay as a valid admin
// cookie. Production refuses to boot without the secret (assertProductionSecrets);
// throwing here covers dev and tests, where callers fail closed: session
// creation surfaces the error and verification treats it as "not signed in".
function getSecretKey() {
  const secret = ENV.adminSessionSecret;
  if (!secret) {
    throw new Error("JWT_SECRET is required to sign or verify admin sessions");
  }
  return new TextEncoder().encode(secret);
}

// Comparing the raw strings returned early whenever the lengths differed, which
// leaks the configured password's length to anyone timing the login endpoint.
// Digesting first makes both operands a fixed 32 bytes, so every wrong password
// costs the same regardless of how close it was.
function safeStringsEqual(a: string, b: string) {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}

// Minimal in-memory throttle for the admin login endpoint. This resets on
// process restart, which is acceptable for a two-person internal panel.
const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

// The key is derived from a client-controlled header, so an attacker rotating
// X-Forwarded-For adds a new entry per request and nothing ever removed them —
// the map grew until the process ran out of memory and Railway restarted it,
// which also wiped the global failure counter that backstops brute forcing.
// Expired entries are swept first; if a flood is fast enough to outrun that,
// the oldest windows are dropped so memory stays bounded either way.
const LOGIN_ATTEMPTS_MAX_ENTRIES = 10_000;

function pruneLoginAttempts(now: number) {
  if (loginAttempts.size < LOGIN_ATTEMPTS_MAX_ENTRIES) return;

  const expired: string[] = [];
  loginAttempts.forEach((entry, key) => {
    if (now - entry.windowStart > LOGIN_WINDOW_MS) expired.push(key);
  });
  expired.forEach(key => loginAttempts.delete(key));

  if (loginAttempts.size < LOGIN_ATTEMPTS_MAX_ENTRIES) return;

  // Map preserves insertion order, so taking from the front drops the least
  // recently created windows — the ones closest to expiring anyway.
  const excess = loginAttempts.size - LOGIN_ATTEMPTS_MAX_ENTRIES + 1;
  const oldest: string[] = [];
  loginAttempts.forEach((_entry, key) => {
    if (oldest.length < excess) oldest.push(key);
  });
  oldest.forEach(key => loginAttempts.delete(key));
}

// Per-IP throttling above is bypassable by anyone who sends a different
// X-Forwarded-For value on each request — confirmed locally: 12 wrong-password
// attempts with a rotated header, zero triggered the per-IP limit. `req.ip`
// trusts that header once `trust proxy` is set (needed so the real client IP
// resolves correctly behind Railway's edge), and there's no way to tell a
// legitimate proxy hop from an attacker-supplied one from inside the app.
//
// This global counter is the actual backstop: it doesn't key by anything the
// client supplies, so no header can reset or split it across "identities".
// Only two people ever log in here, so locking out ALL login attempts once
// failures spike is safe for them and a hard stop for brute-forcing —
// unlike the booking form, there's no legitimate traffic pattern that looks
// like a burst of failed admin logins.
const GLOBAL_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const GLOBAL_LOGIN_MAX_FAILURES = 20;
let globalFailures = { count: 0, windowStart: 0 };

function isGlobalLoginRateLimited() {
  const now = Date.now();
  if (now - globalFailures.windowStart > GLOBAL_LOGIN_WINDOW_MS) return false;
  return globalFailures.count >= GLOBAL_LOGIN_MAX_FAILURES;
}

function recordGlobalLoginFailure() {
  const now = Date.now();
  if (now - globalFailures.windowStart > GLOBAL_LOGIN_WINDOW_MS) {
    globalFailures = { count: 1, windowStart: now };
    return;
  }
  globalFailures.count += 1;
}

export function isLoginRateLimited(ip: string) {
  if (isGlobalLoginRateLimited()) return true;

  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

export function recordLoginAttempt(ip: string) {
  recordGlobalLoginFailure();

  const now = Date.now();
  pruneLoginAttempts(now);
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

export function verifyAdminCredentials(password: string, code = "", now = Date.now()): AdminAccount | null {
  const expected = ENV.adminPassword;
  if (!expected || !password) return null;
  if (!safeStringsEqual(password, expected)) return null;

  const factor = secondFactor();
  if (factor.kind === "broken") return null;
  if (factor.kind === "totp") {
    const step = verifyTotp(factor.key, code.trim(), now);
    if (step === null || step <= lastTotpStep) return null;
    lastTotpStep = step;
  }

  return ADMIN;
}

export async function createAdminSessionToken(account: AdminAccount, authTime = Date.now()) {
  return new SignJWT({ id: account.id, name: account.name, auth_time: Math.floor(authTime / 1000) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_TTL_MS) / 1000))
    .sign(getSecretKey());
}

type VerifiedSession = AdminAccount & { issuedAt: number; authTime: number };

async function verifySession(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (payload.id !== "admin") return null;
    if (typeof payload.name !== "string") return null;
    if (typeof payload.iat !== "number" || typeof payload.auth_time !== "number") return null;
    const authTime = payload.auth_time * 1000;
    if (Date.now() - authTime > SESSION_ABSOLUTE_MS) return null;
    return { id: payload.id, name: payload.name, issuedAt: payload.iat * 1000, authTime };
  } catch {
    return null;
  }
}

export async function verifyAdminSessionToken(token: string): Promise<AdminAccount | null> {
  const session = await verifySession(token);
  return session ? { id: session.id, name: session.name } : null;
}

function readSessionCookie(req: Request) {
  return parseCookie(req.headers.cookie ?? "")[ADMIN_SESSION_COOKIE];
}

export async function getAdminAccountFromRequest(req: Request): Promise<AdminAccount | null> {
  const token = readSessionCookie(req);
  return token ? verifyAdminSessionToken(token) : null;
}

/**
 * Verifies the session and, while it is in active use, reissues the cookie so
 * the 12-hour lifetime slides forward — never past 7 days from sign-in.
 */
export async function authenticateAdmin(req: Request, res: Response): Promise<AdminAccount | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  const account: AdminAccount = { id: session.id, name: session.name };
  if (Date.now() - session.issuedAt > SESSION_REFRESH_AFTER_MS) {
    const remaining = session.authTime + SESSION_ABSOLUTE_MS - Date.now();
    const fresh = await createAdminSessionToken(account, session.authTime);
    res.cookie(ADMIN_SESSION_COOKIE, fresh, {
      ...adminCookieOptions(req),
      maxAge: Math.min(SESSION_TTL_MS, remaining),
    });
  }
  return account;
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function adminCookieOptions(req: Request) {
  return {
    httpOnly: true as const,
    path: "/" as const,
    // "lax" still attaches the cookie to top-level cross-site GETs, so any page
    // that links or redirects into the dashboard navigates as the logged-in
    // admin. Nothing legitimately links into this panel from another origin —
    // both admins reach it by typing the URL — so "strict" costs nothing here
    // and removes that class of cross-site entry entirely.
    sameSite: "strict" as const,
    secure: isSecureRequest(req),
  };
}

export function setAdminSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(ADMIN_SESSION_COOKIE, token, { ...adminCookieOptions(req), maxAge: SESSION_TTL_MS });
}

export function clearAdminSessionCookie(req: Request, res: Response) {
  res.clearCookie(ADMIN_SESSION_COOKIE, { ...adminCookieOptions(req), maxAge: -1 });
}
