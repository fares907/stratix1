import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { createSecurityHeaders } from "./securityHeaders";
import { assertProductionSecrets } from "./env";
import { API_RATE_LIMIT, STATIC_RATE_LIMIT, createRateLimiter } from "./rateLimit";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Fails fast rather than booting with a forgeable admin-session secret.
  assertProductionSecrets();

  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Per-client only: static responses come from memory and are cached at the
  // edge, so a global ceiling here would just lock out real visitors during a
  // flood without protecting anything scarce.
  app.use(createRateLimiter(STATIC_RATE_LIMIT));
  app.use(createSecurityHeaders());
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ limit: "64kb", extended: true }));
  // tRPC API — the stricter limiter runs before the adapter so a shed request
  // never allocates a context or borrows a database connection.
  app.use(
    "/api/trpc",
    createRateLimiter(API_RATE_LIMIT),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Node's defaults let a client hold a socket open indefinitely while dribbling
  // out a request, so a few hundred idle connections can exhaust the pool
  // without ever sending a complete request (slowloris). These caps put a
  // ceiling on how long any one socket can occupy a slot.
  server.headersTimeout = 20_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 15_000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Railway sends SIGTERM before replacing the container on each deploy. Without
  // this the process dies mid-request and those visitors see a failure; draining
  // first lets in-flight bookings finish writing.
  const shutdown = (signal: string) => {
    console.log(`[Server] ${signal} received, draining connections`);
    server.close(() => process.exit(0));
    setTimeout(() => {
      console.warn("[Server] Forcing exit after drain timeout");
      process.exit(0);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch(console.error);
