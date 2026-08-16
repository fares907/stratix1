import { and, count, desc, eq, gte, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { startOfMonth, startOfYear, subMonths } from "date-fns";
import {
  Booking,
  bookings,
  InsertBooking,
  InsertInvoice,
  InsertLedgerEntry,
  InsertUser,
  invoices,
  ledgerEntries,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

function isLocalDatabaseHost(databaseUrl: string) {
  try {
    const { hostname } = new URL(databaseUrl);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const uri = process.env.DATABASE_URL;
      // Managed MySQL providers (TiDB Cloud, PlanetScale, Aiven, etc.) require
      // TLS; local/self-hosted MySQL usually doesn't support it. Only a bare
      // local hostname skips it.
      _db = isLocalDatabaseHost(uri)
        ? drizzle(uri)
        : drizzle({ connection: { uri, ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } } });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getBookingByRequestKey(requestKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.requestKey, requestKey))
    .limit(1);

  return result[0];
}

export async function createBooking(input: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(bookings).values(input);
  const created = await getBookingByRequestKey(input.requestKey);
  if (!created) throw new Error("Booking was not persisted");
  return created;
}

export async function getRecentBookingSignals(input: {
  clientHash: string;
  phone: string;
  since: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const rows = await db
    .select({ clientHash: bookings.clientHash, phone: bookings.phone })
    .from(bookings)
    .where(
      and(
        gte(bookings.createdAt, input.since),
        or(eq(bookings.clientHash, input.clientHash), eq(bookings.phone, input.phone)),
      ),
    )
    .limit(8);

  return {
    byClient: rows.filter(row => row.clientHash === input.clientHash).length,
    byPhone: rows.filter(row => row.phone === input.phone).length,
  };
}

const BOOKING_LIST_MAX_LIMIT = 100;

export async function listBookings(input: {
  status?: Booking["status"];
  search?: string;
  limit: number;
  offset: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const limit = Math.min(Math.max(input.limit, 1), BOOKING_LIST_MAX_LIMIT);

  const conditions = [];
  if (input.status) {
    conditions.push(eq(bookings.status, input.status));
  }
  if (input.search) {
    const term = `%${input.search.trim()}%`;
    conditions.push(or(like(bookings.publicId, term), like(bookings.phone, term)));
  }

  const query = db
    .select()
    .from(bookings)
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(Math.max(input.offset, 0));

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

export async function getBookingStats() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [total, byStatus, byEmailStatus] = await Promise.all([
    db.select({ value: count() }).from(bookings),
    db.select({ status: bookings.status, value: count() }).from(bookings).groupBy(bookings.status),
    db
      .select({ emailStatus: bookings.emailStatus, value: count() })
      .from(bookings)
      .groupBy(bookings.emailStatus),
  ]);

  return {
    total: total[0]?.value ?? 0,
    byStatus: Object.fromEntries(byStatus.map(row => [row.status, row.value])) as Record<
      Booking["status"],
      number
    >,
    byEmailStatus: Object.fromEntries(
      byEmailStatus.map(row => [row.emailStatus, row.value]),
    ) as Record<Booking["emailStatus"], number>,
  };
}

export async function updateBookingStatus(input: { publicId: string; status: Booking["status"] }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(bookings)
    .set({ status: input.status, updatedAt: Date.now() })
    .where(eq(bookings.publicId, input.publicId));
}

export async function updateBookingEmailDelivery(input: {
  publicId: string;
  status: "sent" | "failed" | "not_configured";
  messageId?: string;
  error?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db
    .update(bookings)
    .set({
      emailStatus: input.status,
      emailMessageId: input.messageId ?? null,
      emailError: input.error?.slice(0, 500) ?? null,
      updatedAt: Date.now(),
    })
    .where(eq(bookings.publicId, input.publicId));
}

export async function listLedgerEntries(input: { limit: number; offset: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const limit = Math.min(Math.max(input.limit, 1), 100);

  return db
    .select()
    .from(ledgerEntries)
    .orderBy(desc(ledgerEntries.occurredAt))
    .limit(limit)
    .offset(Math.max(input.offset, 0));
}

export async function createLedgerEntry(input: InsertLedgerEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(ledgerEntries).values(input);
}

export async function deleteLedgerEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.delete(ledgerEntries).where(eq(ledgerEntries.id, id));
}

function sumByType(rows: Array<{ type: "income" | "expense"; amount: string }>, type: "income" | "expense") {
  return rows
    .filter(row => row.type === type)
    .reduce((total, row) => total + Number(row.amount), 0);
}

function totalsFor(rows: Array<{ type: "income" | "expense"; amount: string }>) {
  const income = sumByType(rows, "income");
  const expense = sumByType(rows, "expense");
  return { income, expense, net: income - expense };
}

export async function getLedgerStats() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const now = new Date();
  const monthStart = startOfMonth(now).getTime();
  const yearStart = startOfYear(now).getTime();
  const sixMonthWindowStart = startOfMonth(subMonths(now, 5)).getTime();
  const earliestNeeded = Math.min(yearStart, sixMonthWindowStart);

  const rows = await db
    .select({ type: ledgerEntries.type, amount: ledgerEntries.amount, occurredAt: ledgerEntries.occurredAt })
    .from(ledgerEntries)
    .where(gte(ledgerEntries.occurredAt, earliestNeeded));

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const bucketDate = subMonths(now, 5 - index);
    const bucketStart = startOfMonth(bucketDate).getTime();
    const bucketEnd = startOfMonth(subMonths(bucketDate, -1)).getTime();
    const bucketRows = rows.filter(row => row.occurredAt >= bucketStart && row.occurredAt < bucketEnd);
    const totals = totalsFor(bucketRows);
    return {
      label: bucketDate.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" }),
      ...totals,
    };
  });

  return {
    thisMonth: totalsFor(rows.filter(row => row.occurredAt >= monthStart)),
    thisYear: totalsFor(rows.filter(row => row.occurredAt >= yearStart)),
    last6Months: totalsFor(rows.filter(row => row.occurredAt >= sixMonthWindowStart)),
    monthlyTrend,
  };
}

const INVOICE_LIST_MAX_LIMIT = 100;

export async function listInvoices(input: { limit: number; offset: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const limit = Math.min(Math.max(input.limit, 1), INVOICE_LIST_MAX_LIMIT);

  return db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.occurredAt))
    .limit(limit)
    .offset(Math.max(input.offset, 0));
}

export async function createInvoice(input: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.insert(invoices).values(input);
}

export async function deleteInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.delete(invoices).where(eq(invoices.id, id));
}

// Totals are kept per-currency and never summed together: USD hosting costs and
// EGP expenses are different units, and a single combined number would be wrong.
export async function getInvoiceStats() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const yearStart = startOfYear(new Date()).getTime();

  const rows = await db
    .select({ currency: invoices.currency, amount: invoices.amount, occurredAt: invoices.occurredAt })
    .from(invoices);

  const sumFor = (currency: "USD" | "EGP", since: number) =>
    rows
      .filter(row => row.currency === currency && row.occurredAt >= since)
      .reduce((total, row) => total + Number(row.amount), 0);

  return {
    total: rows.length,
    usdThisYear: sumFor("USD", yearStart),
    egpThisYear: sumFor("EGP", yearStart),
    usdAllTime: sumFor("USD", 0),
    egpAllTime: sumFor("EGP", 0),
  };
}
