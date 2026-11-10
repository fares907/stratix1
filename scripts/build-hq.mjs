// Runs after `vite build`: builds the agents dashboard (agents/dashboard, a
// separate pnpm project) as static files and copies them to dist/public/hq,
// where the site serves them at /hq. The dashboard has no server of its own:
// sign-in and every data rule live in Supabase (auth + row-level security).
import { execSync } from "node:child_process";
import { cp, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dashboard = path.join(root, "agents", "dashboard");
const target = path.join(root, "dist", "public", "hq");

const run = command =>
  execSync(command, {
    cwd: dashboard,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "production" },
  });

run("pnpm install --frozen-lockfile");
run("pnpm build");

await rm(target, { recursive: true, force: true });
await cp(path.join(dashboard, "out"), target, { recursive: true });
console.log("build-hq: dashboard copied to dist/public/hq");
