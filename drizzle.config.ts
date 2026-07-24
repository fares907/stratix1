import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

const url = new URL(connectionString);
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

// Managed MySQL providers (TiDB Cloud, PlanetScale, Aiven, etc.) require TLS;
// local/self-hosted MySQL usually doesn't support it.
const dbCredentials = isLocalHost
  ? { url: connectionString }
  : {
      host: url.hostname,
      port: url.port ? Number(url.port) : undefined,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      ssl: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true },
    };

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials,
});
