import { timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";

// Every visitor reaches the app through Cloudflare, which adds a secret header
// (a Transform Rule) to each request it forwards. Railway's own hostnames would
// otherwise let anyone skip Cloudflare entirely — and with it the WAF, bot
// filtering and DDoS absorption. Requests without the secret are refused.
//
// Unset ORIGIN_SECRET disables the check, so the app keeps working before the
// Cloudflare rule exists and in local development.
const ORIGIN_HEADER = "x-origin-auth";

function secret() {
  return process.env.ORIGIN_SECRET?.trim() ?? "";
}

function isFromCloudflare(req: Request) {
  const expected = secret();
  if (!expected) return false;
  const received = req.get(ORIGIN_HEADER) ?? "";
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireCloudflareOrigin(): RequestHandler {
  return (req, res, next) => {
    if (secret() && !isFromCloudflare(req)) {
      res.status(403).type("text/plain").send("Forbidden");
      return;
    }
    // Never let the secret travel further than this check.
    delete req.headers[ORIGIN_HEADER];
    next();
  };
}

// The visitor's real address. Behind Cloudflare and Railway's proxy, req.ip
// resolves to a Cloudflare edge server shared by thousands of visitors, which
// made per-visitor rate limits behave like shared ones. CF-Connecting-IP holds
// the real address, but it can only be trusted once the origin check has
// proved the request actually came through Cloudflare — set directly on a
// Railway hostname it would be a free choice of identity.
export function clientIp(req: Request): string {
  if (secret()) {
    const cf = req.get("cf-connecting-ip");
    if (cf) return cf;
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}
