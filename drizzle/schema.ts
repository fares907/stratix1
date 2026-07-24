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
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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
    projectType: mysqlEnum("projectType", ["company", "portfolio", "landing", "other"]).notNull(),
    budget: mysqlEnum("budget", ["700-1500", "1500-3000", "3000+"]).notNull(),
    details: text("details").notNull(),
    status: mysqlEnum("status", ["new", "contacted", "closed"]).default("new").notNull(),
    emailStatus: mysqlEnum("emailStatus", ["pending", "sent", "failed", "not_configured"])
      .default("pending")
      .notNull(),
    emailMessageId: varchar("emailMessageId", { length: 128 }),
    emailError: varchar("emailError", { length: 500 }),
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
