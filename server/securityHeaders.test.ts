import { describe, expect, it, vi } from "vitest";
import { createSecurityHeaders } from "./_core/securityHeaders";

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
});
