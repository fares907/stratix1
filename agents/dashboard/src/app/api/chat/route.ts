import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// الشات مع الموظفين: رئيس مجلس الإدارة يسأل أي موظف عن شغله أو قراراته.
//
// - الطلب بيتعمل بجلسة رئيس مجلس الإدارة نفسها، فـ RLS بيمنع أي حد تاني.
// - الموظف بيرد من اللي متسجل فعلًا (كلامه في الاجتماعات، أفكاره، قراراته، مهامه)؛
//   لو السبب مش متسجل بيقول كده بدل ما يألّف.
// - نفس قواعد الـ router: الأساسي وبعده الاحتياطي، والبيانات الحساسة مابتروحش
//   لمزوّد بيستخدم البيانات المجانية، وزرار إيقاف الكل بيوقف الشات كمان.
// - مفاتيح الموديلات server-only هنا (مش NEXT_PUBLIC).

export const dynamic = "force-dynamic";

const KEY_ENV: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

interface ModelRow {
  key: string;
  provider: string;
  model_id: string;
  base_url: string | null;
  trains_on_free_data: boolean;
}

async function db(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: list => list.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
  });
}

const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

function clip(text: string | null | undefined, n: number) {
  return (text ?? "").replace(/\s+/g, " ").slice(0, n);
}

export async function POST(request: Request) {
  const { agent_id: agentId, message } = (await request.json().catch(() => ({}))) as {
    agent_id?: string;
    message?: string;
  };
  if (!agentId || !message?.trim()) return fail("لازم تختار موظف وتكتب رسالة");
  if (message.length > 4000) return fail("الرسالة طويلة أوي");

  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("سجّل دخول الأول", 401);

  // RLS: لو مش owner الاستعلام ده بيرجع فاضي
  const { data: agent } = await supabase.from("agents").select("*").eq("id", agentId).maybeSingle();
  if (!agent) return fail("الموظف مش موجود أو انت مش مسموحلك", 403);
  if (agent.status === "fired") return fail(`${agent.name} اتقال؛ رجّعه من صفحة الموظفين الأول`);

  const { data: state } = await supabase.from("system_state").select("halted").eq("id", 1).maybeSingle();
  if (!state || state.halted) return fail("الشركة واقفة (إيقاف الكل) — شغّلها الأول", 423);

  // ── اللي الموظف يعرفه (من السجل الحقيقي) ─────────────────
  const [said, ideas, tasks, history, meeting, report, rules, roster] = await Promise.all([
    supabase.from("messages").select("content, reasoning, kind, created_at, meeting_id")
      .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(25),
    agentId === "ceo"
      ? supabase.from("proposals").select("id, agent_id, idea, status, ceo_reason, created_at")
          .order("created_at", { ascending: false }).limit(30)
      : supabase.from("proposals").select("id, agent_id, idea, status, ceo_reason, created_at")
          .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(15),
    supabase.from("tasks").select("title, status, details").eq("agent_id", agentId)
      .order("created_at", { ascending: false }).limit(15),
    supabase.from("chats").select("role, content").eq("agent_id", agentId)
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("meetings").select("summary, started_at").eq("status", "done")
      .order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("daily_reports").select("headline").order("report_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("company_settings").select("value").eq("key", "rules").maybeSingle(),
    supabase.from("agents").select("id, name"),
  ]);

  const names = new Map((roster.data ?? []).map(a => [a.id, a.name]));
  const pricing = (rules.data?.value as { pricing?: { min?: number; max?: number } } | undefined)?.pricing;
  const honesty = ((rules.data?.value as { honesty?: string[] } | undefined)?.honesty ?? []).map(l => `- ${l}`).join("\n");

  const memory = [
    "كلامك وتفكيرك المتسجل في الاجتماعات (الأحدث الأول):",
    ...(said.data ?? []).map(m => `- [${m.created_at.slice(0, 16)}] ${clip(m.content, 300)}${m.reasoning ? ` (سببك وقتها: ${clip(m.reasoning, 200)})` : ""}`),
    "",
    agentId === "ceo" ? "الأفكار وقراراتك فيها:" : "أفكارك وقرار المدير فيها:",
    ...(ideas.data ?? []).map(p => `- فكرة #${p.id} من ${names.get(p.agent_id) ?? p.agent_id}: ${clip(p.idea, 200)} ← ${p.status}${p.ceo_reason ? ` (السبب المتسجل: ${clip(p.ceo_reason, 200)})` : " (مفيش سبب متسجل)"}`),
    "",
    "مهامك:",
    ...(tasks.data ?? []).map(t => `- ${t.title} (${t.status})`),
    "",
    `آخر قرار اجتماع: ${clip(meeting.data?.summary, 600) || "مفيش"}`,
    `آخر تقرير: ${report.data?.headline ?? "مفيش"}`,
  ].join("\n");

  const system =
    `انت ${agent.name}، ${agent.title} في شركة STRATIX. بتكلّم رئيس مجلس الإدارة مباشرة.\n` +
    `مهامك: ${(agent.duties ?? []).join("، ")}\n${agent.instructions ?? ""}\n` +
    (agent.status === "paused" ? "ملحوظة: انت موقوف مؤقتًا عن الشغل دلوقتي.\n" : "") +
    `الأسعار المسموحة: من ${pricing?.min ?? "؟"} لـ ${pricing?.max ?? "؟"} جنيه.\n${honesty}\n\n` +
    "رد بالعامية المصرية زي موظف بيكلم مديره: مباشر ومحترم ومختصر.\n" +
    "لما يسألك عن قرار أو فكرة، اشرح السبب من السجل اللي تحت بالظبط. لو السبب مش متسجل قول" +
    " \"السبب ده مش متسجل عندي\" وقول رأيك دلوقتي على إنه رأي. ممنوع تألّف أرقام أو أحداث مش في السجل.\n" +
    "لو طلب منك تعمل حاجة، قوله هتتعمل في التشغيل الجاي، أو إن ده محتاج موافقة لو فيه فلوس أو وعد.\n\n" +
    memory;

  const past = (history.data ?? []).reverse().map(c => ({
    role: c.role === "owner" ? "user" : "assistant",
    content: c.content,
  }));
  const messages = [{ role: "system", content: system }, ...past, { role: "user", content: message }];

  // ── الأساسي وبعده الاحتياطي ─────────────────────────────
  const { data: catalog } = await supabase.from("model_catalog").select("*").in("key", [agent.primary_model, agent.fallback_model]);
  const chain = [agent.primary_model, agent.fallback_model]
    .map(key => (catalog as ModelRow[] | null)?.find(m => m.key === key))
    .filter((m): m is ModelRow => Boolean(m));

  const reasons: string[] = [];
  for (const [index, model] of chain.entries()) {
    const apiKey = process.env[KEY_ENV[model.provider] ?? ""];
    if (!apiKey || !model.base_url) { reasons.push(`${model.key}: مفيش مفتاح`); continue; }
    if (agent.sensitive && model.trains_on_free_data) { reasons.push(`${model.key}: بيانات حساسة`); continue; }

    const started = Date.now();
    let status = "ok";
    let reply = "";
    let usage: { prompt_tokens?: number; completion_tokens?: number } = {};
    try {
      const res = await fetch(`${model.base_url}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.model_id, messages, temperature: 0.5 }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429) status = "rate_limited";
      else if (!res.ok) status = `http_${res.status}`;
      else {
        const data = await res.json();
        reply = String(data?.choices?.[0]?.message?.content ?? "").trim();
        usage = data?.usage ?? {};
        if (!reply) status = "bad_response";
      }
    } catch {
      status = "network_error";
    }
    await supabase.from("llm_calls").insert({
      agent_id: agentId, provider: model.provider, model_key: model.key, model_id: model.model_id,
      is_fallback: index > 0, status, latency_ms: Date.now() - started,
      prompt_tokens: usage.prompt_tokens ?? 0, completion_tokens: usage.completion_tokens ?? 0,
    });
    if (status !== "ok") { reasons.push(`${model.key}: ${status}`); continue; }

    await supabase.from("chats").insert([
      { agent_id: agentId, role: "owner", content: message },
      { agent_id: agentId, role: "agent", content: reply, model_key: model.key },
    ]);
    return Response.json({ reply, model_key: model.key, used_fallback: index > 0 });
  }
  return fail(`${agent.name} مش قادر يرد دلوقتي — ${reasons.join("؛ ") || "مفيش موديل متاح"}`, 503);
}
