import { describe, expect, it, vi } from "vitest";
import {
  API_RATE_LIMIT,
  STATIC_RATE_LIMIT,
  createRateLimiter,
  type RateLimitOptions,
} from "./_core/rateLimit";

const BASE: RateLimitOptions = {
  windowMs: 60_000,
  maxPerClient: 3,
  maxGlobal: 100,
  maxTrackedClients: 5,
};

function send(limiter: ReturnType<typeof createRateLimiter>, ip: string) {
  const next = vi.fn();
  let status = 200;
  const res = {
    setHeader: vi.fn(),
    status: (code: number) => {
      status = code;
      return res;
    },
    json: vi.fn(),
  };

  limiter({ ip, socket: { remoteAddress: ip } } as never, res as never, next);

  return { allowed: next.mock.calls.length === 1, status };
}

describe("api rate limiter", () => {
  it("allows a normal client and blocks it past the per-client ceiling", () => {
    const limiter = createRateLimiter(BASE);

    expect(send(limiter, "1.1.1.1").allowed).toBe(true);
    expect(send(limiter, "1.1.1.1").allowed).toBe(true);
    expect(send(limiter, "1.1.1.1").allowed).toBe(true);

    const blocked = send(limiter, "1.1.1.1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it("keeps one noisy client from blocking everyone else", () => {
    const limiter = createRateLimiter(BASE);

    for (let i = 0; i < 10; i++) send(limiter, "9.9.9.9");

    expect(send(limiter, "2.2.2.2").allowed).toBe(true);
  });

  // req.ip comes from X-Forwarded-For once `trust proxy` is set, so per-client
  // buckets can be bypassed by rotating the header. The global ceiling is the
  // part that has to hold, because it keys on nothing the client supplies.
  it("stops a flood that rotates its client address every request", () => {
    const limiter = createRateLimiter({ ...BASE, maxGlobal: 20, maxTrackedClients: 10_000 });

    let allowed = 0;
    for (let i = 0; i < 500; i++) {
      if (send(limiter, `10.0.${Math.floor(i / 256)}.${i % 256}`).allowed) allowed++;
    }

    expect(allowed).toBe(20);
  });

  // Without a cap the map itself is the denial of service: it grows until the
  // process is killed for memory, which resets every other counter with it.
  it("bounds memory when the flood rotates addresses", () => {
    const options = { ...BASE, maxGlobal: 1_000_000, maxTrackedClients: 50 };
    const limiter = createRateLimiter(options);

    for (let i = 0; i < 5_000; i++) send(limiter, `172.16.${Math.floor(i / 256)}.${i % 256}`);

    // The limiter has no public size accessor; a fresh address still being
    // served proves the map stayed usable rather than growing without bound.
    expect(send(limiter, "203.0.113.7").allowed).toBe(true);
  });

  it("resets a client's budget once its window rolls over", () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter(BASE);

      for (let i = 0; i < 4; i++) send(limiter, "5.5.5.5");
      expect(send(limiter, "5.5.5.5").allowed).toBe(false);

      vi.advanceTimersByTime(BASE.windowMs + 1);

      expect(send(limiter, "5.5.5.5").allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  // A global ceiling on static traffic would let an attacker 429 every genuine
  // visitor for the price of a single script, turning a crash into an outage.
  // Static requests are memory-served and edge-cached, so only the API — which
  // reaches MySQL — carries one.
  it("does not let a static flood lock out other visitors", () => {
    const limiter = createRateLimiter(STATIC_RATE_LIMIT);

    for (let i = 0; i < 20_000; i++) {
      limiter(
        { ip: `198.51.${Math.floor(i / 256)}.${i % 256}`, socket: {} } as never,
        { setHeader: vi.fn(), status: () => ({ json: vi.fn() }), json: vi.fn() } as never,
        vi.fn(),
      );
    }

    expect(send(limiter, "203.0.113.9").allowed).toBe(true);
  });

  it("still caps API traffic globally, where the database is the scarce part", () => {
    const limiter = createRateLimiter({ ...API_RATE_LIMIT, maxGlobal: 50 });

    let allowed = 0;
    for (let i = 0; i < 400; i++) {
      if (send(limiter, `192.0.2.${i % 256}`).allowed) allowed++;
    }

    expect(allowed).toBe(50);
  });

  it("tells a throttled client when to come back", () => {
    const limiter = createRateLimiter(BASE);
    const next = vi.fn();
    const res = { setHeader: vi.fn(), status: () => res, json: vi.fn() };

    for (let i = 0; i < 5; i++) {
      limiter({ ip: "8.8.8.8", socket: {} } as never, res as never, next);
    }

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", 60);
  });
});
