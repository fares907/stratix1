import { describe, expect, it, vi, beforeEach } from "vitest";

const state = { on: false };
vi.mock("./db", () => ({
  getDb: async () => ({
    execute: async (q: unknown) => {
      const text = JSON.stringify(q);
      if (text.includes("SELECT")) return [[{ value: state.on ? "on" : "off", updatedAt: 1 }]];
      return [[]];
    },
  }),
}));

import { maintenanceGate, setMaintenance } from "./maintenance";

function run(path: string) {
  const res: Record<string, unknown> = { headers: {} };
  const out = { status: 200, nextCalled: false, body: "" as unknown };
  const r = {
    setHeader: (k: string, v: string) => ((res.headers as Record<string, string>)[k] = v),
    status(code: number) { out.status = code; return this; },
    type() { return this; },
    send(b: unknown) { out.body = b; return this; },
    json(b: unknown) { out.body = b; return this; },
  };
  return maintenanceGate()({ path } as never, r as never, () => { out.nextCalled = true; }).then(() => out);
}

describe("maintenance gate", () => {
  beforeEach(async () => {
    state.on = false;
    await setMaintenance(false);
  });

  it("lets everything through when off", async () => {
    expect((await run("/")).nextCalled).toBe(true);
    expect((await run("/api/trpc/booking.submit")).nextCalled).toBe(true);
  });

  it("closes public pages and forms but keeps the dashboards open when on", async () => {
    state.on = true;
    await setMaintenance(true);
    for (const page of ["/", "/en", "/pay", "/track"]) {
      const out = await run(page);
      expect(out.status).toBe(503);
      expect(String(out.body)).toContain("بنطوّر الموقع");
    }
    expect((await run("/api/trpc/booking.submit")).status).toBe(503);
    expect((await run("/api/trpc/contact.request,payment.lookup")).status).toBe(503);
    for (const open of ["/admin", "/admin/x", "/hq", "/hq/reports/", "/assets/app.js", "/fonts/a.woff2",
      "/api/trpc/adminAuth.me", "/api/trpc/adminSite.setMaintenance", "/api/agents/facts"]) {
      expect((await run(open)).nextCalled, open).toBe(true);
    }
  });
});
