// Adds what order tracking and stored chat leads need:
//   - bookings.stage and bookings.stageUpdatedAt
//   - the contactLeads table
//   - 'admin' as an allowed author on ledgerEntries and invoices
//
// Run this BEFORE deploying the code that uses them: the app selects every
// column it knows about, so a deploy that reaches a database without `stage`
// would fail every bookings query.
//
// Only adds — never drops, never rewrites rows. Safe to run twice; existing
// bookings start at the "received" stage.
//
//   node scripts/ensure-tracking-and-leads.mjs
//
// (Same reason as the other ensure-* scripts for not using `pnpm db:push`:
// drizzle-kit migrate replays the baseline and aborts on tables that exist.)
import mysql from "mysql2/promise";

try {
  process.loadEnvFile();
} catch {}

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

const bookingColumns = [
  [
    "stage",
    "ADD COLUMN `stage` enum('received','design','development','review','delivered') NOT NULL DEFAULT 'received'",
  ],
  ["stageUpdatedAt", "ADD COLUMN `stageUpdatedAt` bigint unsigned NULL"],
];

const createLeads = `CREATE TABLE IF NOT EXISTS \`contactLeads\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`topic\` enum('new_site','existing_issue','other') NOT NULL,
  \`phone\` varchar(24) NOT NULL,
  \`clientEmail\` varchar(320) NULL,
  \`note\` text NULL,
  \`status\` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
  \`emailStatus\` enum('pending','sent','failed','not_configured') NOT NULL DEFAULT 'pending',
  \`createdAt\` bigint unsigned NOT NULL,
  \`updatedAt\` bigint unsigned NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`contact_leads_created_at_idx\` (\`createdAt\`)
)`;

try {
  const [existing] = await connection.query(
    `SELECT column_name AS name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'bookings'`,
  );
  const present = new Set(existing.map(row => row.name));

  for (const [name, clause] of bookingColumns) {
    if (present.has(name)) {
      console.log(`  = bookings.${name} already exists`);
      continue;
    }
    await connection.query(`ALTER TABLE \`bookings\` ${clause}`);
    console.log(`  + bookings.${name} added`);
  }

  await connection.query(createLeads);
  console.log("  = contactLeads table present");

  // The dashboard now has one account. Appending a value to an ENUM leaves
  // every existing row ('fares' / 'youssef') untouched.
  for (const table of ["ledgerEntries", "invoices"]) {
    const [[column]] = await connection.query(
      `SELECT column_type AS type FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'createdBy'`,
      [table],
    );
    if (column.type.includes("'admin'")) {
      console.log(`  = ${table}.createdBy already allows 'admin'`);
      continue;
    }
    await connection.query(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`createdBy\` enum('fares','youssef','admin') NOT NULL`,
    );
    console.log(`  + ${table}.createdBy now allows 'admin'`);
  }

  // Prove the app's own query shapes work, so a green run means the deploy
  // will be able to read and write these.
  const [bookingsCheck] = await connection.query(
    "SELECT publicId, stage, stageUpdatedAt FROM `bookings` LIMIT 1",
  );
  const [leadsCheck] = await connection.query(
    "SELECT id, topic, phone, status, emailStatus FROM `contactLeads` LIMIT 1",
  );
  console.log(
    `\n✓ verified: bookings readable with stage (${bookingsCheck.length} sampled), contactLeads readable (${leadsCheck.length} sampled).`,
  );
} catch (error) {
  console.error("✗ failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
