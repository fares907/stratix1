import express from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAgentsFactsHandler, isAgentsWorkflow } from "./agentsFacts";

const GOOD = {
  repository: "fares907/stratix1",
  ref: "refs/heads/main",
  workflow_ref: "fares907/stratix1/.github/workflows/agents.yml@refs/heads/main",
};

let base = "";
let close = () => {};

beforeAll(() => {
  const app = express();
  const verify = async (token: string) => {
    if (token === "good") return GOOD;
    if (token === "branch") return { ...GOOD, ref: "refs/heads/other" };
    if (token === "fork") return { ...GOOD, repository: "someone/stratix1" };
    throw new Error("bad signature");
  };
  app.get("/api/agents/facts", createAgentsFactsHandler(verify, async () => ({ ledger: { net: 500 } }) as never));
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agents/facts`;
  close = () => server.close();
});

afterAll(() => close());

const get = (token?: string) => fetch(base, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe("agents facts endpoint", () => {
  it("answers the agents workflow on main", async () => {
    const res = await get("good");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ledger: { net: 500 } });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses requests without a token or with a forged one", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("forged")).status).toBe(401);
  });

  it("refuses other branches and other repositories", async () => {
    expect((await get("branch")).status).toBe(403);
    expect((await get("fork")).status).toBe(403);
  });

  it("only trusts the agents workflow file", () => {
    expect(isAgentsWorkflow(GOOD)).toBe(true);
    expect(isAgentsWorkflow({ ...GOOD, workflow_ref: "fares907/stratix1/.github/workflows/ci.yml@refs/heads/main" })).toBe(false);
  });
});

describe("what the agents may see", () => {
  it("never includes phone numbers, emails or payment references", async () => {
    const { collectAgentsFacts } = await import("./agentsFacts");
    const source = collectAgentsFacts.toString();
    for (const field of ["phone", "clientEmail", "paymentReference", "clientHash", "requestKey"]) {
      expect(source).not.toContain(field);
    }
  });
});
