import type { NextFunction, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

// Maintenance mode: the founders switch it on from the admin dashboard while they
// fix things. Visitors then see a "we're improving the site" page instead of the
// site, and the public forms refuse new submissions. The admin dashboard (/admin),
// the agents dashboard (/hq), every API the dashboards use and the static assets
// they load keep working, so the switch can always be turned back off.
//
// The flag lives in the site database (one row in siteSettings), so it survives
// restarts and every instance agrees. It is cached for a few seconds so visitors
// never cost a query per request.

const CACHE_MS = 5_000;
let cached: { on: boolean; at: number; since: number | null } | null = null;
let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`CREATE TABLE IF NOT EXISTS siteSettings (
    \`key\` varchar(64) NOT NULL PRIMARY KEY,
    \`value\` text NOT NULL,
    updatedAt bigint unsigned NOT NULL
  )`);
  tableReady = true;
}

export interface MaintenanceState {
  on: boolean;
  since: number | null;
}

export async function getMaintenance(fresh = false): Promise<MaintenanceState> {
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return { on: cached.on, since: cached.since };
  try {
    await ensureTable();
    const db = await getDb();
    if (!db) return { on: false, since: null };
    const [rows] = (await db.execute(
      sql`SELECT \`value\`, updatedAt FROM siteSettings WHERE \`key\` = 'maintenance' LIMIT 1`,
    )) as unknown as [Array<{ value: string; updatedAt: number | string }>];
    const row = rows?.[0];
    const on = row?.value === "on";
    cached = { on, at: Date.now(), since: on && row ? Number(row.updatedAt) : null };
  } catch (error) {
    // A database hiccup must never take the whole site down: keep the last known
    // answer, or stay open if there is none.
    console.warn("[Maintenance] Could not read the flag:", error);
    if (!cached) return { on: false, since: null };
  }
  return { on: cached!.on, since: cached!.since };
}

export async function setMaintenance(on: boolean): Promise<MaintenanceState> {
  await ensureTable();
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const now = Date.now();
  await db.execute(sql`INSERT INTO siteSettings (\`key\`, \`value\`, updatedAt)
    VALUES ('maintenance', ${on ? "on" : "off"}, ${now})
    ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)`);
  cached = { on, at: now, since: on ? now : null };
  return { on, since: cached.since };
}

// Paths that stay reachable during maintenance.
function isAlwaysOpen(path: string) {
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  if (path === "/hq" || path.startsWith("/hq/")) return true;
  if (path.startsWith("/assets/")) return true;
  // Every API stays open except the visitors' own tRPC calls, which the gate checks separately.
  if (path.startsWith("/api/")) return true;
  // Any real file (fonts, icons, robots.txt, the dashboards' scripts): only pages are closed.
  return /\.[a-z0-9]{2,5}$/i.test(path);
}

// The public tRPC procedures visitors use. Admin and dashboard calls stay open.
const PUBLIC_PROCEDURES = ["booking.", "contact.", "payment.", "tracking."];

function isPublicTrpcCall(path: string) {
  if (!path.startsWith("/api/trpc/")) return false;
  const procedures = path.slice("/api/trpc/".length).split(",");
  return procedures.some(p => PUBLIC_PROCEDURES.some(prefix => p.startsWith(prefix)));
}

export function maintenanceGate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (isAlwaysOpen(req.path) && !isPublicTrpcCall(req.path)) return next();
    const state = await getMaintenance();
    if (!state.on) return next();

    res.setHeader("Retry-After", "3600");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    if (req.path.startsWith("/api/")) {
      res.status(503).json({ error: { message: "الموقع في صيانة دلوقتي، جرّب تاني بعد شوية." } });
      return;
    }
    res.status(503).type("html").send(MAINTENANCE_PAGE);
  };
}

export const MAINTENANCE_PAGE = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>STRATIX — جاري تطوير الموقع</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body {
    min-height: 100vh; display: grid; place-items: center; padding: 24px;
    font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif;
    background: radial-gradient(1200px 600px at 80% -10%, rgba(139, 92, 246, .28), transparent 60%),
                radial-gradient(900px 500px at -10% 110%, rgba(34, 211, 238, .18), transparent 60%),
                #0b0a1a;
    color: #ece9ff;
  }
  .card {
    width: 100%; max-width: 560px; text-align: center; padding: 44px 28px;
    border-radius: 24px; background: rgba(255, 255, 255, .04);
    border: 1px solid rgba(255, 255, 255, .09); box-shadow: 0 30px 80px rgba(0, 0, 0, .45);
  }
  .brand {
    font-family: "Alexandria", "Segoe UI", system-ui, sans-serif; font-weight: 800; letter-spacing: .08em;
    font-size: 28px; direction: ltr;
    background: linear-gradient(90deg, #a78bfa, #f472b6, #22d3ee);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .gear {
    width: 64px; height: 64px; margin: 28px auto 22px; border-radius: 50%;
    border: 6px dashed rgba(167, 139, 250, .85); animation: spin 6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .gear { animation: none; } }
  h1 { font-size: 24px; line-height: 1.5; margin-bottom: 12px; }
  p { color: #b9b3d9; line-height: 1.9; font-size: 16px; }
  .en { direction: ltr; margin-top: 26px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, .08); font-size: 14px; }
  .en strong { color: #ece9ff; display: block; margin-bottom: 4px; font-size: 16px; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">STRATIX</div>
    <div class="gear" aria-hidden="true"></div>
    <h1>بنطوّر الموقع دلوقتي</h1>
    <p>بنعمل شوية تحسينات وإصلاحات عشان نقدّم لك تجربة أحسن.<br />من فضلك ارجع لنا بعد شوية، وشكرًا لصبرك.</p>
    <p class="en"><strong>We'll be right back</strong>We're making a few improvements to the site. Please check back a little later.</p>
  </main>
</body>
</html>`;
