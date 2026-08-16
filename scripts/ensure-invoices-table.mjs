// One-off, surgical fix: create the `invoices` table if it is missing.
//
// Why this exists: `pnpm db:push` runs drizzle-kit migrate, which replays from
// the baseline migration (CREATE TABLE bookings …). When the original tables
// were created outside that journal, the very first statement fails with
// "table already exists" and the whole run aborts — so migration 0002, which
// adds `invoices`, never applies. The dashboard then reads an empty list fine
// but every insert is rejected because the table does not exist.
//
// This script touches ONLY `invoices`. It uses CREATE TABLE IF NOT EXISTS, so
// running it twice is harmless, and it never alters bookings, ledgerEntries or
// users. It reads DATABASE_URL from your environment / .env — the value never
// leaves your machine.
//
//   node scripts/ensure-invoices-table.mjs

import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run from the project root so .env is loaded.");
  process.exit(1);
}

const parsed = new URL(url);
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);

const connection = await mysql.createConnection({
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : 3306,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.replace(/^\//, ""),
  ssl: isLocal ? undefined : { minVersion: "TLSv1.2", rejectUnauthorized: true },
});

try {
  const [before] = await connection.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'invoices'",
  );
  if (before[0].n > 0) {
    console.log("✓ invoices table already exists — nothing to do.");
  } else {
    console.log("invoices table is missing — creating it…");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`invoices\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`category\` enum('domain','hosting','cloud','tools','marketing','other') NOT NULL,
        \`amount\` decimal(10,2) NOT NULL,
        \`currency\` enum('USD','EGP') NOT NULL,
        \`note\` varchar(255) NOT NULL,
        \`occurredAt\` bigint unsigned NOT NULL,
        \`createdBy\` enum('fares','youssef') NOT NULL,
        \`createdAt\` bigint unsigned NOT NULL,
        CONSTRAINT \`invoices_id\` PRIMARY KEY(\`id\`)
      )
    `);
    // CREATE INDEX has no IF NOT EXISTS in MySQL/TiDB; ignore "duplicate key name".
    try {
      await connection.query("CREATE INDEX `invoices_occurred_at_idx` ON `invoices` (`occurredAt`)");
    } catch (error) {
      if (!/Duplicate key name/i.test(String(error?.message))) throw error;
    }
    console.log("✓ invoices table created.");
  }

  // Prove it is usable: a real insert-and-delete round trip.
  await connection.query(
    "INSERT INTO `invoices` (category, amount, currency, note, occurredAt, createdBy, createdAt) VALUES (?,?,?,?,?,?,?)",
    ["other", "1.00", "USD", "__setup check__", Date.now(), "fares", Date.now()],
  );
  await connection.query("DELETE FROM `invoices` WHERE note = '__setup check__'");
  console.log("✓ verified: the table accepts and removes a row. Invoices are ready.");
} catch (error) {
  console.error("✗ failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
