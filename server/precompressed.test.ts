import express from "express";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { brotliCompressSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { servePrecompressed } from "./_core/precompressed";

const source = "console.log('stratix');".repeat(200);
let root: string;
let base: string;
let close: () => void;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "precompressed-"));
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "assets", "app.js"), source);
  fs.writeFileSync(path.join(root, "assets", "app.js.br"), brotliCompressSync(source));
  fs.writeFileSync(path.join(root, "secret.txt"), "should never be served");

  const app = express();
  app.use(servePrecompressed(root));
  app.use((_req, res) => res.status(404).send("fallthrough"));
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

afterAll(() => {
  close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("precompressed static files", () => {
  it("serves the Brotli file with the original type and long-lived caching", async () => {
    const res = await fetch(`${base}/assets/app.js`, { headers: { "accept-encoding": "br" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-encoding")).toBe("br");
    expect(res.headers.get("content-type")).toMatch(/javascript/);
    expect(res.headers.get("vary")).toBe("Accept-Encoding");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(await res.text()).toBe(source);
  });

  it("falls through when the browser does not accept the encoding", async () => {
    const res = await fetch(`${base}/assets/app.js`, { headers: { "accept-encoding": "identity" } });
    expect(await res.text()).toBe("fallthrough");
  });

  // Only paths that exist as compressed files are ever matched, so a crafted
  // path has nothing to resolve against.
  it("never matches paths outside the known compressed files", async () => {
    for (const url of ["/secret.txt", "/assets/../secret.txt", "/assets/%2e%2e/secret.txt"]) {
      const res = await fetch(`${base}${url}`, { headers: { "accept-encoding": "br" } });
      expect(await res.text()).toBe("fallthrough");
    }
  });
});
