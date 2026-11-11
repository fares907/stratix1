import express from "express";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSecurityHeaders } from "./_core/securityHeaders";
import { hqContentSecurityPolicy, serveHq } from "./_core/hq";

let base = "";
let close = () => {};

beforeAll(async () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "hq-"));
  fs.mkdirSync(path.join(dist, "hq", "team"), { recursive: true });
  fs.mkdirSync(path.join(dist, "hq", "_next", "static"), { recursive: true });
  fs.writeFileSync(path.join(dist, "hq", "index.html"), "<p>room</p>");
  fs.writeFileSync(path.join(dist, "hq", "team", "index.html"), "<p>team</p>");
  fs.writeFileSync(path.join(dist, "hq", "404.html"), "<p>missing</p>");
  fs.writeFileSync(path.join(dist, "hq", "_next", "static", "app.js"), "1");

  const app = express();
  app.use(createSecurityHeaders(true));
  serveHq(app, dist);
  app.use((_req, res) => res.send("site"));
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

afterAll(() => close());

describe("agents dashboard at /hq", () => {
  it("serves each page's index with its own policy and keeps it out of search", async () => {
    const res = await fetch(`${base}/hq/team/`);
    expect(await res.text()).toBe("<p>team</p>");
    const policy = res.headers.get("content-security-policy") ?? "";
    expect(policy).toContain("connect-src 'self' https://frpqnfygixxolvpseqox.supabase.co wss://frpqnfygixxolvpseqox.supabase.co");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    // the chairman talks to the team by voice, so only the dashboard may use the mic
    expect(res.headers.get("permissions-policy")).toContain("microphone=(self)");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("caches hashed assets for good", async () => {
    const res = await fetch(`${base}/hq/_next/static/app.js`);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("answers unknown dashboard paths with its own 404, not the site", async () => {
    const res = await fetch(`${base}/hq/nope/`);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("<p>missing</p>");
  });

  it("leaves the public site's strict policy alone", async () => {
    const res = await fetch(`${base}/`);
    expect(await res.text()).toBe("site");
    expect(res.headers.get("content-security-policy")).not.toContain("unsafe-inline' ; connect");
    expect(res.headers.get("content-security-policy")).toContain("script-src 'self';");
    expect(res.headers.get("permissions-policy")).toContain("microphone=()");
  });

  it("only widens connect-src to the configured Supabase origin", () => {
    expect(hqContentSecurityPolicy("https://abc.supabase.co")).toContain(
      "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co",
    );
  });
});
