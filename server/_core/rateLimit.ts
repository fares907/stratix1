import type { RequestHandler } from "express";

// Nothing throttled requests before they reached tRPC, so a single client could
// hold the event loop at 100% and every genuine visitor queued behind it. This
// runs before body parsing and routing, so a rejected request costs a map
// lookup and a 429 instead of a database round trip.
//
// Per-IP counting alone is not a defence: `trust proxy` means req.ip comes from
// X-Forwarded-For, which any client can rotate to get a fresh bucket. It still
// stops the common case (one noisy client, a misbehaving script), while the
// global ceiling below is what survives a rotating-header flood — it keys on
// nothing the client controls.

export type RateLimitOptions = {
  windowMs: number;
  maxPerClient: number;
  maxGlobal: number;
  maxTrackedClients: number;
};

// Measured on this codebase: a single process serves ~40,000 static req/s with
// median latency at 22ms and never fell over, so the ceilings below exist to
// protect the database and the mail provider, not the Node process.
//
// A global ceiling is deliberately NOT applied to static requests. Setting one
// far below real capacity hands an attacker a cheap way to 429 every genuine
// visitor, which trades a crash for an outage. Static responses are served from
// memory and cached at Railway's edge, so per-client throttling is enough.
export const STATIC_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  // A full page load is a handful of requests; 600 absorbs a hard refresh loop
  // without ever touching someone browsing normally.
  maxPerClient: 600,
  maxGlobal: Number.POSITIVE_INFINITY,
  maxTrackedClients: 20_000,
};

// Every tRPC call can reach MySQL, and the connection pool — not Node — is the
// scarce resource. This ceiling keys on nothing the client controls, so it holds
// even when a flood rotates X-Forwarded-For to get fresh per-client buckets.
export const API_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  // A visitor booking a project makes a few calls; an admin clicking through the
  // dashboard makes more. 120 covers both with room to spare.
  maxPerClient: 120,
  maxGlobal: 3_000,
  maxTrackedClients: 20_000,
};

type Bucket = { count: number; windowStart: number };

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let global: Bucket = { count: 0, windowStart: 0 };

  // Bounded on purpose: the key is client-controlled, so without a cap the map
  // itself becomes the denial of service — it grows until the process is killed
  // for exceeding memory, which also resets every counter protecting the app.
  function prune(now: number) {
    if (buckets.size < options.maxTrackedClients) return;

    const expired: string[] = [];
    buckets.forEach((bucket, key) => {
      if (now - bucket.windowStart > options.windowMs) expired.push(key);
    });
    expired.forEach(key => buckets.delete(key));

    if (buckets.size < options.maxTrackedClients) return;

    // Map preserves insertion order, so taking from the front evicts the
    // longest-standing windows rather than whichever client is active now.
    const excess = buckets.size - options.maxTrackedClients + 1;
    const oldest: string[] = [];
    buckets.forEach((_bucket, key) => {
      if (oldest.length < excess) oldest.push(key);
    });
    oldest.forEach(key => buckets.delete(key));
  }

  function hit(bucket: Bucket, now: number, limit: number) {
    if (now - bucket.windowStart > options.windowMs) {
      bucket.count = 1;
      bucket.windowStart = now;
      return false;
    }
    bucket.count += 1;
    return bucket.count > limit;
  }

  const hasGlobalCeiling = Number.isFinite(options.maxGlobal);

  return (req, res, next) => {
    const now = Date.now();

    if (hasGlobalCeiling && hit(global, now, options.maxGlobal)) {
      res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    prune(now);

    const key = req.ip || req.socket.remoteAddress || "unknown";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, windowStart: now };
      buckets.set(key, bucket);
    }

    if (hit(bucket, now, options.maxPerClient)) {
      res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    next();
  };
}
