import { describe, expect, it } from "vitest";
import { createWindowLimiter } from "./_core/windowLimiter";

describe("per-visitor window limiter", () => {
  it("limits one visitor without affecting another, and resets after the window", () => {
    const limiter = createWindowLimiter({ windowMs: 1000, max: 2 });
    limiter.record("a", 0);
    limiter.record("a", 10);
    expect(limiter.isLimited("a", 20)).toBe(true);
    expect(limiter.isLimited("b", 20)).toBe(false);
    expect(limiter.isLimited("a", 1_500)).toBe(false);
  });

  // Keys come from the network, so an unbounded map would itself be the outage.
  it("keeps memory bounded under a flood of distinct visitors", () => {
    const limiter = createWindowLimiter({ windowMs: 60_000, max: 1, maxKeys: 100 });
    for (let i = 0; i < 10_000; i++) limiter.record(`visitor-${i}`, i);
    expect(limiter.isLimited("visitor-9999", 10_000)).toBe(true);
    expect(limiter.isLimited("visitor-0", 10_000)).toBe(false);
  });
});
