// Adds the payment tracking columns to `bookings` if they are missing.
//
// Why this exists rather than `pnpm db:push`: drizzle-kit migrate replays from
// the baseline migration, whose first statement creates tables that already
// exist, so the run aborts before reaching anything new. Same reason the
// invoices table needed its own script.
//
// Only ADDs columns — never drops, never rewrites existing rows. Safe to run
// twice: each column is checked first, and existing bookings simply get the
// defaults (unpaid, EGP, no amount yet).
//
//   node scripts/ensure-payment-columns.mjs

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

// Order matters only for readability; each is independent.
const columns = [
  ["amountDue", "ADD COLUMN `amountDue` decimal(10,2) NULL"],
  ["currency", "ADD COLUMN `currency` enum('EGP','USD','SAR','AED') NOT NULL DEFAULT 'EGP'"],
  [
    "paymentStatus",
    "ADD COLUMN `paymentStatus` enum('unpaid','awaiting_review','paid') NOT NULL DEFAULT 'unpaid'",
  ],
  ["paymentReference", "ADD COLUMN `paymentReference` varchar(120) NULL"],
  ["paymentDeclaredAt", "ADD COLUMN `paymentDeclaredAt` bigint unsigned NULL"],
  ["paidAt", "ADD COLUMN `paidAt` bigint unsigned NULL"],
];

try {
  const [existing] = await connection.query(
    `SELECT column_name AS name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'bookings'`,
  );
  const present = new Set(existing.map(row => row.name));

  let added = 0;
  for (const [name, clause] of columns) {
    if (present.has(name)) {
      console.log(`  = ${name} already exists`);
      continue;
    }
    await connection.query(`ALTER TABLE \`bookings\` ${clause}`);
    console.log(`  + ${name} added`);
    added++;
  }

  if (added === 0) {
    console.log("\n✓ Nothing to do — all payment columns were already present.");
  } else {
    console.log(`\n✓ ${added} column(s) added.`);
  }

  // Prove the app's own query shape works against the new schema, so a green
  // run means the dashboard and payment page will actually read these fields.
  const [check] = await connection.query(
    "SELECT publicId, amountDue, currency, paymentStatus FROM `bookings` LIMIT 1",
  );
  console.log(`✓ verified: bookings can be read with the payment columns (${check.length} row(s) sampled).`);
} catch (error) {
  console.error("✗ failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
