import express, { type Express, type RequestHandler } from "express";
import fs from "node:fs";
import path from "node:path";

// The agents dashboard (agents/dashboard) is a static Next.js export copied to
// dist/public/hq by scripts/build-hq.mjs. It has no server of its own: sign-in
// and every data rule are enforced by Supabase (auth + row-level security), so
// this only serves files.
//
// It needs a looser policy than the public site in two ways, both scoped to
// /hq: Next.js bootstraps each page with inline scripts, and the browser talks
// to Supabase directly (REST, auth, realtime websocket, the chat function).
const DEFAULT_SUPABASE_URL = "https://frpqnfygixxolvpseqox.supabase.co";

export function hqContentSecurityPolicy(supabaseUrl = process.env.HQ_SUPABASE_URL ?? DEFAULT_SUPABASE_URL) {
  const origin = new URL(supabaseUrl).origin;
  const realtime = origin.replace(/^https:/, "wss:");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${origin} ${realtime}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Same lockdown as the public site, except the microphone: the chairman talks
// to the team by voice in the dashboard (speech-to-text runs in the browser).
export const HQ_PERMISSIONS_POLICY =
  "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()";

export function createHqHeaders(): RequestHandler {
  const policy = hqContentSecurityPolicy();
  return (_req, res, next) => {
    res.setHeader("Content-Security-Policy", policy);
    res.setHeader("Permissions-Policy", HQ_PERMISSIONS_POLICY);
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  };
}

export function serveHq(app: Express, distPath: string) {
  const hqPath = path.join(distPath, "hq");
  if (!fs.existsSync(hqPath)) return;

  app.use(
    "/hq",
    createHqHeaders(),
    express.static(hqPath, {
      index: "index.html",
      setHeaders(res, filePath) {
        const hashed = filePath.includes(`${path.sep}_next${path.sep}static${path.sep}`);
        res.setHeader("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "no-cache");
      },
    }),
    (_req, res) => {
      res.status(404).setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(hqPath, "404.html"));
    },
  );
}
