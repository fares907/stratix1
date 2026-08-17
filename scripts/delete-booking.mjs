// Deletes one booking by its public id. Deliberately a script and not a button:
// the dashboard has no delete action because removing a real client's record
// should be rare and considered, not one mis-tap away.
//
// List what exists:
//   node scripts/delete-booking.mjs --list
//
// Delete a specific one:
//   node scripts/delete-booking.mjs STRX-11AA22BB33
//
// Deleting is permanent. The nightly backup keeps 90 days, so a mistake is
// recoverable from there — but only from there.

import "dotenv/config";
import mysql from "mysql2/promise";

const arg = process.argv[2];

if (!arg) {
  console.error("Usage:\n  node scripts/delete-booking.mjs --list\n  node scripts/delete-booking.mjs <ORDER-ID>");
  process.exit(1);
}

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

const fmt = ts => (ts ? new Date(Number(ts)).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" }) : "—");

try {
  if (arg === "--list") {
    const [rows] = await connection.query(
      `SELECT publicId, name, phone, status, paymentStatus, amountDue, currency, createdAt
       FROM bookings ORDER BY createdAt DESC LIMIT 50`,
    );

    if (rows.length === 0) {
      console.log("No bookings in the database.");
    } else {
      console.log(`${rows.length} booking(s):\n`);
      for (const r of rows) {
        console.log(`  ${r.publicId}`);
        console.log(`    name    : ${r.name}`);
        console.log(`    phone   : ${r.phone}`);
        console.log(`    status  : ${r.status} / payment: ${r.paymentStatus}`);
        console.log(`    amount  : ${r.amountDue ? `${r.amountDue} ${r.currency}` : "not set"}`);
        console.log(`    created : ${fmt(r.createdAt)}\n`);
      }
      console.log("To delete one:  node scripts/delete-booking.mjs <ORDER-ID>");
    }
  } else {
    const publicId = arg.trim().toUpperCase();

    // Show exactly what is about to go, so a wrong id is caught before the
    // delete rather than after it.
    const [found] = await connection.query(
      `SELECT publicId, name, phone, status, paymentStatus, amountDue, currency, createdAt
       FROM bookings WHERE publicId = ?`,
      [publicId],
    );

    if (found.length === 0) {
      console.error(`No booking found with id "${publicId}". Run --list to see what exists.`);
      process.exitCode = 1;
    } else {
      const b = found[0];
      console.log("About to delete:\n");
      console.log(`  ${b.publicId}`);
      console.log(`    name    : ${b.name}`);
      console.log(`    phone   : ${b.phone}`);
      console.log(`    amount  : ${b.amountDue ? `${b.amountDue} ${b.currency}` : "not set"}`);
      console.log(`    created : ${fmt(b.createdAt)}\n`);

      const [result] = await connection.query("DELETE FROM bookings WHERE publicId = ?", [publicId]);
      console.log(
        result.affectedRows === 1
          ? `✓ Deleted ${publicId}. This cannot be undone except from a backup.`
          : `✗ Nothing was deleted (${result.affectedRows} rows affected).`,
      );
    }
  }
} catch (error) {
  console.error("✗ failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
