import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "a".repeat(48);

async function loadAuth() {
  vi.resetModules();
  return import("./_core/adminAuth");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin session signing", () => {
  it("round-trips a session when the secret is configured", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    const auth = await loadAuth();

    const token = await auth.createAdminSessionToken({ id: "fares", name: "فارس سامي" });

    expect(await auth.verifyAdminSessionToken(token)).toEqual({ id: "fares", name: "فارس سامي" });
  });

  // The secret used to fall back to a constant committed to this repository, so
  // a missing environment variable meant anyone reading the source could sign a
  // cookie the server accepted as an admin session.
  it("refuses to mint a session when JWT_SECRET is missing", async () => {
    vi.stubEnv("JWT_SECRET", "");
    const auth = await loadAuth();

    await expect(auth.createAdminSessionToken({ id: "fares", name: "فارس" })).rejects.toThrow(
      /JWT_SECRET/,
    );
  });

  it("treats any token as invalid when JWT_SECRET is missing", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    const signing = await loadAuth();
    const token = await signing.createAdminSessionToken({ id: "youssef", name: "يوسف" });

    vi.stubEnv("JWT_SECRET", "");
    const verifying = await loadAuth();

    expect(await verifying.verifyAdminSessionToken(token)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    const signing = await loadAuth();
    const token = await signing.createAdminSessionToken({ id: "fares", name: "فارس" });

    vi.stubEnv("JWT_SECRET", "b".repeat(48));
    const verifying = await loadAuth();

    expect(await verifying.verifyAdminSessionToken(token)).toBeNull();
  });

  it("rejects a token whose payload claims an unknown account", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    const auth = await loadAuth();
    const { SignJWT } = await import("jose");

    const forged = await new SignJWT({ id: "intruder", name: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(new TextEncoder().encode(SECRET));

    expect(await auth.verifyAdminSessionToken(forged)).toBeNull();
  });
});

describe("admin credential check", () => {
  it("accepts the configured password and rejects a wrong one", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD_FARES", "correct-horse-battery");
    const auth = await loadAuth();

    expect(auth.verifyAdminCredentials("fares", "correct-horse-battery")).toEqual({
      id: "fares",
      name: "فارس سامي",
    });
    expect(auth.verifyAdminCredentials("fares", "wrong")).toBeNull();
  });

  // The old comparison returned early on a length mismatch, which let an
  // attacker time the endpoint to learn how long the real password is.
  it("rejects passwords of every length without an early length exit", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD_FARES", "correct-horse-battery");
    const auth = await loadAuth();

    for (const guess of ["a", "a".repeat(20), "a".repeat(500)]) {
      expect(auth.verifyAdminCredentials("fares", guess)).toBeNull();
    }
  });

  it("fails closed when no password is configured", async () => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD_FARES", "");
    const auth = await loadAuth();

    expect(auth.verifyAdminCredentials("fares", "")).toBeNull();
    expect(auth.verifyAdminCredentials("fares", "anything")).toBeNull();
  });
});

describe("production secret validation", () => {
  it("refuses to boot in production without a signing secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();
    const { assertProductionSecrets } = await import("./_core/env");

    expect(() => assertProductionSecrets()).toThrow(/JWT_SECRET is not set/);
  });

  it("refuses to boot in production with a short signing secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "short");
    vi.stubEnv("ADMIN_PASSWORD_FARES", "x");
    vi.stubEnv("ADMIN_PASSWORD_YOUSSEF", "y");
    vi.resetModules();
    const { assertProductionSecrets } = await import("./_core/env");

    expect(() => assertProductionSecrets()).toThrow(/at least 32/);
  });

  it("starts in production when everything is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("ADMIN_PASSWORD_FARES", "x");
    vi.stubEnv("ADMIN_PASSWORD_YOUSSEF", "y");
    vi.resetModules();
    const { assertProductionSecrets } = await import("./_core/env");

    expect(() => assertProductionSecrets()).not.toThrow();
  });

  it("stays out of the way in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "");
    vi.resetModules();
    const { assertProductionSecrets } = await import("./_core/env");

    expect(() => assertProductionSecrets()).not.toThrow();
  });
});
