import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { clientIp, requireCloudflareOrigin } from "./_core/origin";

async function serve(handler: express.RequestHandler) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(requireCloudflareOrigin());
  app.use(handler);
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

const echo: express.RequestHandler = (req, res) =>
  res.json({ ip: clientIp(req), leaked: req.get("x-origin-auth") ?? null });

const SECRET = "s3cret-value-that-is-long-enough";

afterEach(() => {
  delete process.env.ORIGIN_SECRET;
});

describe("Cloudflare origin lock", () => {
  it("refuses a request that skipped Cloudflare", async () => {
    process.env.ORIGIN_SECRET = SECRET;
    const app = await serve(echo);
    const res = await fetch(app.url);
    app.close();
    expect(res.status).toBe(403);
  });

  it("refuses a wrong secret, including one of a different length", async () => {
    process.env.ORIGIN_SECRET = SECRET;
    const app = await serve(echo);
    const wrong = await fetch(app.url, { headers: { "x-origin-auth": SECRET.replace("s", "S") } });
    const short = await fetch(app.url, { headers: { "x-origin-auth": "x" } });
    app.close();
    expect(wrong.status).toBe(403);
    expect(short.status).toBe(403);
  });

  // Behind Cloudflare req.ip is an edge server shared by many visitors, so the
  // per-visitor limits must key on the address Cloudflare reports.
  it("admits Cloudflare traffic, uses the real visitor address, and strips the secret", async () => {
    process.env.ORIGIN_SECRET = SECRET;
    const app = await serve(echo);
    const res = await fetch(app.url, {
      headers: { "x-origin-auth": SECRET, "cf-connecting-ip": "203.0.113.7" },
    });
    const body = await res.json();
    app.close();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ip: "203.0.113.7", leaked: null });
  });

  // Without the lock anyone can reach the origin directly, so a client-supplied
  // CF-Connecting-IP must not be believed — it would let them pick any identity.
  it("ignores CF-Connecting-IP when the lock is not configured", async () => {
    const app = await serve(echo);
    const res = await fetch(app.url, { headers: { "cf-connecting-ip": "203.0.113.7" } });
    const body = await res.json();
    app.close();
    expect(res.status).toBe(200);
    expect(body.ip).not.toBe("203.0.113.7");
  });
});
