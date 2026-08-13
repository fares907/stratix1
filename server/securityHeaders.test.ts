import { afterEach, describe, expect, it, vi } from "vitest";
import { createSecurityHeaders } from "./_core/securityHeaders";

function getPolicy(isProduction: boolean) {
  const headers = new Map<string, string>();
  const response = { setHeader: (name: string, value: string) => headers.set(name, value) };
  createSecurityHeaders(isProduction)({} as never, response as never, vi.fn());
  return headers.get("Content-Security-Policy") ?? "";
}

function getDirective(policy: string, name: string) {
  return policy.split("; ").find(directive => directive.startsWith(`${name} `)) ?? "";
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security headers", () => {
  it("sets browser hardening headers and HSTS in production", () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader: (name: string, value: string) => headers.set(name, value),
    };
    const next = vi.fn();

    createSecurityHeaders(true)({} as never, response as never, next);

    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("upgrade-insecure-requests");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(headers.get("Strict-Transport-Security")).toContain("preload");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not emit HSTS in local development", () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader: (name: string, value: string) => headers.set(name, value),
    };

    createSecurityHeaders(false)({} as never, response as never, vi.fn());

    expect(headers.has("Strict-Transport-Security")).toBe(false);
    expect(headers.get("Content-Security-Policy")).not.toContain("upgrade-insecure-requests");
    expect(headers.get("Content-Security-Policy")).toContain("'unsafe-inline'");
  });

  // Umami Cloud loads its script from one origin and POSTs events to another.
  // connect-src used to be derived from the script origin alone, which blocked
  // every event in production and recorded zero visitors.
  it("allows the Umami Cloud collection origin in connect-src", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://cloud.umami.is");

    const policy = getPolicy(true);

    expect(getDirective(policy, "connect-src")).toContain("https://gateway.umami.is");
    expect(getDirective(policy, "connect-src")).toContain("https://cloud.umami.is");
    // The script itself is still only allowed from the origin that serves it.
    expect(getDirective(policy, "script-src")).not.toContain("gateway.umami.is");
  });

  it("keeps a single origin for self-hosted analytics", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://stats.example.com");

    const connectSrc = getDirective(getPolicy(true), "connect-src");

    expect(connectSrc).toBe("connect-src 'self' https://stats.example.com");
    expect(connectSrc).not.toContain("umami");
  });

  it("adds no external origins when analytics is disabled", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "");

    const policy = getPolicy(true);

    expect(getDirective(policy, "connect-src")).toBe("connect-src 'self'");
    expect(getDirective(policy, "script-src")).toBe("script-src 'self'");
  });

  it("honours an explicit collection endpoint override", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://cloud.umami.is");
    vi.stubEnv("ANALYTICS_COLLECT_ENDPOINT", "https://collect.example.com/api/send");

    const connectSrc = getDirective(getPolicy(true), "connect-src");

    expect(connectSrc).toContain("https://collect.example.com");
    expect(connectSrc).not.toContain("gateway.umami.is");
  });
});
