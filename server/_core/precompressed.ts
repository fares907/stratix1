import fs from "node:fs";
import path from "node:path";
import type { RequestHandler } from "express";

const ENCODINGS = [
  { name: "br", ext: ".br" },
  { name: "gzip", ext: ".gz" },
] as const;

// Serves the .br / .gz files written at build time by scripts/compress-assets.mjs.
// The lookup table is built once at startup from what is actually on disk, so a
// request path is only ever matched against known files — never joined onto the
// filesystem — and a missing variant just falls through to the plain file.
export function servePrecompressed(root: string): RequestHandler {
  const available = new Map<string, Set<string>>();

  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
        continue;
      }
      const encoding = ENCODINGS.find(candidate => entry.name.endsWith(candidate.ext));
      if (!encoding) continue;
      const original = full.slice(0, -encoding.ext.length);
      const urlPath = "/" + path.relative(root, original).split(path.sep).join("/");
      if (!available.has(urlPath)) available.set(urlPath, new Set());
      available.get(urlPath)!.add(encoding.name);
    }
  };
  scan(root);

  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const variants = available.get(req.path);
    if (!variants) return next();

    const accepted = (req.get("accept-encoding") ?? "").toLowerCase();
    const encoding = ENCODINGS.find(
      candidate => variants.has(candidate.name) && accepted.includes(candidate.name),
    );
    if (!encoding) return next();

    const isHashedAsset = req.path.startsWith("/assets/");
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("Content-Encoding", encoding.name);
    res.setHeader(
      "Cache-Control",
      isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache",
    );
    res.type(path.extname(req.path));
    res.sendFile(path.join(root, req.path + encoding.ext));
  };
}
