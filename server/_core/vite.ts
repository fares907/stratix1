import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { servePrecompressed } from "./precompressed";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${randomUUID()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Keep the admin dashboard out of every search index. A meta tag alone would
  // not help here — the page is a client-rendered SPA, so a crawler that does
  // not run JS sees only the shell — but this response header is read before any
  // rendering. It does not add access control (the login does that); it just
  // stops the panel and the founders' names from ever surfacing in results.
  app.use((req, res, next) => {
    if (req.path === "/admin" || req.path.startsWith("/admin/")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
    next();
  });

  const precompressed = servePrecompressed(distPath);
  app.use(precompressed);

  app.use(
    express.static(distPath, {
      // "/" is answered by the SPA fallback below, so it gets the compressed page too.
      index: false,
      setHeaders(res, filePath) {
        const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader(
          "Cache-Control",
          isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache",
        );
      },
    }),
  );

  // Every client-side route gets the app shell, compressed when the browser
  // allows. /en gets the English shell, whose language, title, description and
  // share tags are already English before any JavaScript runs.
  app.use((req, res) => {
    const shell = req.path === "/en" || req.path.startsWith("/en/") ? "en.html" : "index.html";
    req.url = `/${shell}`;
    precompressed(req, res, () => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.resolve(distPath, shell));
    });
  });
}
