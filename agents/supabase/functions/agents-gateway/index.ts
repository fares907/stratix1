// بوابة الـ agents لقاعدة البيانات.
//
// GitHub Actions مش معاه أي مفتاح Supabase. بدل كده بيطلب من GitHub توكن هوية (OIDC)
// موقّع من GitHub، والبوابة دي:
//   1. بتتأكد من توقيع التوكن (مفاتيح GitHub العامة)، وإنه لسه ساري، ومعمول لينا (aud).
//   2. بتتأكد إنه جاي من الريبو fares907/stratix1، من workflow الـ agents، على main.
//   3. بتسمح بس بطلبات REST للجداول (/rest/v1/...)، وطلبات الموديلات (/llm/<مزوّد>/chat/completions).
//   4. بتعدّي الطلب لـ Supabase بمفتاح service_role، أو للمزوّد بمفتاحه من Supabase Vault.
//      يعني مفاتيح الموديلات عمرها ما بتخرج برّا Supabase.
// يعني أي حد تاني (أو PR من fork، أو branch تاني) مايقدرش يوصل للداتا.

import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "stratix-hq";
const REPOSITORY = "fares907/stratix1";
const WORKFLOW = `${REPOSITORY}/.github/workflows/agents.yml@refs/heads/main`;
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// المزوّدين اللي مفاتيحهم في Vault (اسم السر = KEY)
const LLM: Record<string, { url: string; secret: string }> = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", secret: "GROQ_API_KEY" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", secret: "GEMINI_API_KEY" },
};

async function vaultSecret(name: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/agent_secret`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ secret_name: name }),
  });
  if (!res.ok) return null;
  return (await res.json()) as string | null;
}

const deny = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return deny(401, "missing token");

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE });
    if (payload.repository !== REPOSITORY) return deny(403, "wrong repository");
    if (payload.ref !== "refs/heads/main") return deny(403, "only main");
    if (payload.workflow_ref !== WORKFLOW) return deny(403, "only the agents workflow");
  } catch {
    return deny(401, "invalid token");
  }

  const url = new URL(req.url);
  const marker = "/agents-gateway";
  const rest = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);

  const llm = rest.match(/^\/llm\/([a-z]+)\/chat\/completions$/);
  if (llm) {
    const target = LLM[llm[1]];
    if (!target || req.method !== "POST") return deny(404, "unknown model provider");
    const key = await vaultSecret(target.secret);
    if (!key) return deny(503, `no ${target.secret} in vault`);
    const upstream = await fetch(target.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: await req.text(),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        ...(upstream.headers.get("retry-after") ? { "Retry-After": upstream.headers.get("retry-after")! } : {}),
      },
    });
  }

  if (!rest.startsWith("/rest/v1/")) return deny(404, "only /rest/v1 and /llm");
  // مفاتيح Vault بتتقري جوه البوابة بس، عمرها ما بترجع للـ workflow
  if (rest.startsWith("/rest/v1/rpc/agent_secret")) return deny(403, "secrets stay in the gateway");
  if (!["GET", "POST", "PATCH"].includes(req.method)) return deny(405, "method not allowed");

  const headers = new Headers({
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": req.headers.get("content-type") ?? "application/json",
  });
  const prefer = req.headers.get("prefer");
  if (prefer) headers.set("Prefer", prefer);

  const upstream = await fetch(`${SUPABASE_URL}${rest}${url.search}`, {
    method: req.method,
    headers,
    body: req.method === "GET" ? undefined : await req.text(),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
});
