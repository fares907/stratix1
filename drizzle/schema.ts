import { bigint, decimal, index, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

// The database still holds an empty `users` table from the original template's
// OAuth login, which was never used. It is no longer modelled here; dropping
// it from the database is left to a deliberate manual step.

export const BOOKING_STAGES = ["received", "design", "development", "review", "delivered"] as const;

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

    // Where the project is, as the client sees it on the tracking page. Owners
    // move it forward from the dashboard; it is independent of `status`, which
    // tracks the sales conversation rather than the build.
    stage: mysqlEnum("stage", BOOKING_STAGES).default("received").notNull(),
    stageUpdatedAt: bigint("stageUpdatedAt", { mode: "number", unsigned: true }),

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
    createdBy: mysqlEnum("createdBy", ["fares", "youssef", "admin"]).notNull(),
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
    createdBy: mysqlEnum("createdBy", ["fares", "youssef", "admin"]).notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("invoices_occurred_at_idx").on(table.occurredAt)],
);

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// Leads from the chat's "talk to us" handoff. They used to exist only as an
// email, so a failed send left nothing behind but a server log line. Stored
// now so every lead shows up in the dashboard whatever happened to the email.
export const contactLeads = mysqlTable(
  "contactLeads",
  {
    id: int("id").autoincrement().primaryKey(),
    topic: mysqlEnum("topic", ["new_site", "existing_issue", "other"]).notNull(),
    phone: varchar("phone", { length: 24 }).notNull(),
    clientEmail: varchar("clientEmail", { length: 320 }),
    note: text("note"),
    status: mysqlEnum("status", ["new", "contacted", "closed"]).default("new").notNull(),
    emailStatus: mysqlEnum("emailStatus", ["pending", "sent", "failed", "not_configured"])
      .default("pending")
      .notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("contact_leads_created_at_idx").on(table.createdAt)],
);

export type ContactLead = typeof contactLeads.$inferSelect;
export type InsertContactLead = typeof contactLeads.$inferInsert;
