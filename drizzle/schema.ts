import { bigint, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const bookings = mysqlTable(
  "bookings",
  {
    id: int("id").autoincrement().primaryKey(),
    publicId: varchar("publicId", { length: 32 }).notNull().unique(),
    requestKey: varchar("requestKey", { length: 64 }).notNull().unique(),
    clientHash: varchar("clientHash", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 24 }).notNull(),
    clientEmail: varchar("clientEmail", { length: 320 }),
    projectType: mysqlEnum("projectType", ["company", "personal", "other"]).notNull(),
    budget: mysqlEnum("budget", ["700-1500", "1500-3000", "3000+"]).notNull(),
    details: text("details").notNull(),
    status: mysqlEnum("status", ["new", "contacted", "closed"]).default("new").notNull(),
    emailStatus: mysqlEnum("emailStatus", ["pending", "sent", "failed", "not_configured"])
      .default("pending")
      .notNull(),
    emailMessageId: varchar("emailMessageId", { length: 128 }),
    emailError: varchar("emailError", { length: 500 }),

    // Payment is settled outside the app — the client transfers by InstaPay or
    // bank transfer and an owner confirms it against the account. These columns
    // record that process, they do not perform it. No card data is involved and
    // none is ever stored.
    //
    // amountDue is null until an owner quotes the project, which is why the
    // payment page tells a client their quote is not ready rather than showing
    // a zero. Currency is per-booking because clients are not all in Egypt.
    amountDue: decimal("amountDue", { precision: 10, scale: 2 }),
    currency: mysqlEnum("currency", ["EGP", "USD", "SAR", "AED"]).default("EGP").notNull(),
    paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "awaiting_review", "paid"])
      .default("unpaid")
      .notNull(),
    // What the client typed after transferring (a transfer id or reference).
    // Treated as a claim to check, never as proof of payment.
    paymentReference: varchar("paymentReference", { length: 120 }),
    paymentDeclaredAt: bigint("paymentDeclaredAt", { mode: "number", unsigned: true }),
    paidAt: bigint("paidAt", { mode: "number", unsigned: true }),

    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    index("bookings_created_at_idx").on(table.createdAt),
    index("bookings_client_created_at_idx").on(table.clientHash, table.createdAt),
    index("bookings_phone_created_at_idx").on(table.phone, table.createdAt),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

export const ledgerEntries = mysqlTable(
  "ledgerEntries",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["income", "expense"]).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    note: varchar("note", { length: 255 }).notNull(),
    occurredAt: bigint("occurredAt", { mode: "number", unsigned: true }).notNull(),
    createdBy: mysqlEnum("createdBy", ["fares", "youssef"]).notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("ledger_occurred_at_idx").on(table.occurredAt)],
);

export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type InsertLedgerEntry = typeof ledgerEntries.$inferInsert;

// Company bills — what the business pays out to run: domain, hosting, tools.
// Kept separate from ledgerEntries on purpose: that table tracks client money
// in EGP, while operating costs are usually billed in USD, so mixing them into
// one running total would produce a meaningless figure. Amount and currency are
// stored together and never summed across currencies.
export const invoices = mysqlTable(
  "invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    category: mysqlEnum("category", [
      "domain",
      "hosting",
      "cloud",
      "tools",
      "marketing",
      "other",
    ]).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: mysqlEnum("currency", ["USD", "EGP"]).notNull(),
    note: varchar("note", { length: 255 }).notNull(),
    occurredAt: bigint("occurredAt", { mode: "number", unsigned: true }).notNull(),
    createdBy: mysqlEnum("createdBy", ["fares", "youssef"]).notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("invoices_occurred_at_idx").on(table.occurredAt)],
);

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
