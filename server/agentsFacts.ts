import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getBookingStats, getContactLeadStats, getInvoiceStats, getLedgerStats } from "./db";

// Read-only company numbers for the AI agents team (agents/): the finance,
// projects and analytics agents report on these in the daily meetings.
//
// No secret is shared with the agents. The agents workflow asks GitHub for an
// OIDC identity token addressed to this site, and this endpoint only answers a
// token that GitHub signed for the agents workflow running on main in this
// repository. It returns aggregates only — no customer names, phones or emails.

const ISSUER = "https://token.actions.githubusercontent.com";
export const AGENTS_AUDIENCE = "stratix-site";
const REPOSITORY = "fares907/stratix1";
const WORKFLOW = `${REPOSITORY}/.github/workflows/agents.yml@refs/heads/main`;

type Verify = (token: string) => Promise<JWTPayload>;

const githubJwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const verifyGithubToken: Verify = async token =>
  (await jwtVerify(token, githubJwks, { issuer: ISSUER, audience: AGENTS_AUDIENCE })).payload;

export function isAgentsWorkflow(payload: JWTPayload): boolean {
  return payload.repository === REPOSITORY && payload.ref === "refs/heads/main" && payload.workflow_ref === WORKFLOW;
}

export async function collectAgentsFacts() {
  const [ledger, invoices, bookings, contacts] = await Promise.all([
    getLedgerStats(),
    getInvoiceStats(),
    getBookingStats(),
    getContactLeadStats(),
  ]);
  return {
    ledger: { thisMonth: ledger.thisMonth, thisYear: ledger.thisYear, monthlyTrend: ledger.monthlyTrend },
    invoices,
    bookings,
    contacts,
  };
}

export function createAgentsFactsHandler(
  verify: Verify = verifyGithubToken,
  collect: typeof collectAgentsFacts = collectAgentsFacts,
): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "missing token" });
      return;
    }
    let payload: JWTPayload;
    try {
      payload = await verify(token);
    } catch {
      res.status(401).json({ error: "invalid token" });
      return;
    }
    if (!isAgentsWorkflow(payload)) {
      res.status(403).json({ error: "only the agents workflow on main" });
      return;
    }
    try {
      res.json(await collect());
    } catch {
      res.status(503).json({ error: "database unavailable" });
    }
  };
}
