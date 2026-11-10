// الشات بين رئيس مجلس الإدارة وأي موظف (من صفحة "كلّم الموظفين" في اللوحة).
//
// - verify_jwt: لازم جلسة Supabase سليمة، وكل الاستعلامات بتتعمل بجلسة المستخدم نفسه،
//   فـ RLS بيمنع أي حد مش رئيس مجلس الإدارة.
// - الموظف بيرد من اللي متسجل فعلًا: كلامه وأسبابه في الاجتماعات، الأفكار وقرارات المدير
//   فيها، مهامه، آخر اجتماع، وآخر تقرير. لو السبب مش متسجل بيقول كده.
// - الموديل: الأساسي ثم الاحتياطي (لو مفاتيحهم متحطة كـ secrets هنا)، وبعدهم
//   الاحتياطي العام المجاني من غير مفتاح. البيانات الحساسة مابتروحش لمزوّد بيحتفظ بالبيانات.
// - زرار إيقاف الكل بيوقف الشات كمان.
// - اللي رئيس مجلس الإدارة بيقوله بيتسجل، والموظف بياخده في الاجتماع الجاي.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const KEY_ENV: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  github: "GITHUB_MODELS_TOKEN",
  pollinations: "",
};
const LAST_RESORT = ["pollinations:openai"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string, status = 400) => json({ error }, status);
const clip = (text: string | null | undefined, n: number) => (text ?? "").replace(/\s+/g, " ").slice(0, n);

interface ModelRow {
  key: string;
  provider: string;
  model_id: string;
  base_url: string | null;
  trains_on_free_data: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("POST only", 405);

  const { agent_id: agentId, message } = await req.json().catch(() => ({}));
  if (!agentId || typeof message !== "string" || !message.trim()) return fail("لازم تختار موظف وتكتب رسالة");
  if (message.length > 4000) return fail("الرسالة طويلة أوي");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });

  // RLS: لو المستخدم مش owner الاستعلام ده بيرجع فاضي
  const { data: agent } = await supabase.from("agents").select("*").eq("id", agentId).maybeSingle();
  if (!agent) return fail("الموظف مش موجود أو انت مش مسموحلك", 403);
  if (agent.status === "fired") return fail(`${agent.name} اتقال؛ رجّعه من صفحة الموظفين الأول`);

  const { data: state } = await supabase.from("system_state").select("halted").eq("id", 1).maybeSingle();
  if (!state || state.halted) return fail("الشركة واقفة (إيقاف الكل) — شغّلها الأول", 423);

  const isCeo = agentId === "ceo";
  const [said, ideas, tasks, history, meeting, report, rules, roster] = await Promise.all([
    supabase.from("messages").select("content, reasoning, created_at")
      .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(25),
    isCeo
      ? supabase.from("proposals").select("id, agent_id, idea, status, ceo_reason").order("created_at", { ascending: false }).limit(30)
      : supabase.from("proposals").select("id, agent_id, idea, status, ceo_reason").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(15),
    isCeo
      ? supabase.from("tasks").select("agent_id, title, status").order("created_at", { ascending: false }).limit(30)
      : supabase.from("tasks").select("agent_id, title, status").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(15),
    supabase.from("chats").select("role, content").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(20),
    supabase.from("meetings").select("summary, started_at, kind").eq("status", "done").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("daily_reports").select("report_date, body").order("report_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("company_settings").select("value").eq("key", "rules").maybeSingle(),
    supabase.from("agents").select("id, name, title, status"),
  ]);

  const names = new Map((roster.data ?? []).map((a) => [a.id, a.name]));
  const rulesValue = (rules.data?.value ?? {}) as { pricing?: { min?: number; max?: number }; honesty?: string[] };
  const memory = [
    "كلامك وتفكيرك المتسجل (الأحدث الأول):",
    ...(said.data ?? []).map((m) => `- [${m.created_at.slice(0, 16)}] ${clip(m.content, 300)}${m.reasoning ? ` (سببك: ${clip(m.reasoning, 200)})` : ""}`),
    "",
    isCeo ? "الأفكار وقراراتك فيها:" : "أفكارك وقرار المدير فيها:",
    ...(ideas.data ?? []).map((p) => `- فكرة #${p.id} من ${names.get(p.agent_id) ?? p.agent_id}: ${clip(p.idea, 200)} ← ${p.status}${p.ceo_reason ? ` (السبب المتسجل: ${clip(p.ceo_reason, 200)})` : " (مفيش سبب متسجل)"}`),
    "",
    isCeo ? "المهام اللي اتوزعت:" : "مهامك:",
    ...(tasks.data ?? []).map((t) => `- ${names.get(t.agent_id) ?? t.agent_id}: ${t.title} (${t.status})`),
    "",
    `آخر اجتماع (${meeting.data?.kind ?? "-"}): ${clip(meeting.data?.summary, 800) || "لسه مفيش اجتماعات"}`,
    isCeo ? `آخر تقرير يومي (${report.data?.report_date ?? "-"}):\n${clip(report.data?.body, 2000) || "لسه مفيش تقارير"}` : "",
    isCeo ? `الفريق: ${(roster.data ?? []).map((a) => `${a.name} (${a.title}، ${a.status})`).join("، ")}` : "",
  ].join("\n");

  const system =
    `انت ${agent.name}، ${agent.title} في شركة STRATIX. بتكلّم رئيس مجلس الإدارة مباشرة.\n` +
    `مهامك: ${(agent.duties ?? []).join("، ")}\n${agent.instructions ?? ""}\n` +
    (agent.status === "paused" ? "ملحوظة: انت موقوف مؤقتًا عن الشغل دلوقتي.\n" : "") +
    `الأسعار المسموحة: من ${rulesValue.pricing?.min ?? "؟"} لـ ${rulesValue.pricing?.max ?? "؟"} جنيه.\n` +
    (rulesValue.honesty ?? []).map((l) => `- ${l}`).join("\n") + "\n\n" +
    "رد بالعامية المصرية زي موظف بيكلم مديره: مباشر ومحترم ومختصر.\n" +
    "لما يسألك عن قرار أو فكرة، اشرح السبب من السجل اللي تحت بالظبط. لو السبب مش متسجل قول" +
    " \"السبب ده مش متسجل عندي\" وقول رأيك دلوقتي على إنه رأي. ممنوع تألّف أرقام أو أحداث مش في السجل.\n" +
    "اتكلم بس عن الموظفين والأقسام اللي في السجل (الإدارة، المبيعات، العمليات، الموقع والأمان، التطوير)." +
    " مفيش قسم تسويق ومفيش مشاريع أو حملات غير اللي مكتوبة في السجل. لو السجل فاضي قول بصراحة إن الشغل لسه" +
    " مابدأش وأول اجتماع هيبقى الصبح، واقترح على إيه نركز من غير ما تألّف إن حاجة حصلت.\n" +
    "شغلنا اليومي الحقيقي: الكشّاف بيدوّر على محلات ومطاعم في بنها مالهاش موقع، وبنكتبلهم رسايل بالعامية" +
    " (الأسعار من 2000 لـ 3000 جنيه)، وفريق الموقع بيفحص stratix.website، واجتماعين في اليوم وتقرير بالليل.\n" +
    "لو اداك توجيه (زي \"ركزوا على كذا بكرة\")، أكّد إنك فهمته وقوله هتعرضه في الاجتماع الجاي" +
    (isCeo ? " وهتوزّع المهام على أساسه." : ".") +
    " لو فيه فلوس برّا الأسعار أو وعد لعميل، قوله إن ده محتاج موافقته من صندوق الموافقات.\n\n" +
    memory;

  const past = (history.data ?? []).reverse().map((c) => ({
    role: c.role === "owner" ? "user" : "assistant",
    content: c.content,
  }));
  const messages = [{ role: "system", content: system }, ...past, { role: "user", content: message }];

  const keys = [...new Set([agent.primary_model, agent.fallback_model, ...LAST_RESORT])];
  const { data: catalog } = await supabase.from("model_catalog").select("*").in("key", keys);
  const chain = keys
    .map((key) => (catalog as ModelRow[] | null)?.find((m) => m.key === key))
    .filter((m): m is ModelRow => Boolean(m));

  const reasons: string[] = [];
  for (const [index, model] of chain.entries()) {
    const keyEnv = KEY_ENV[model.provider];
    const apiKey = keyEnv ? Deno.env.get(keyEnv) : "";
    if (keyEnv === undefined || (keyEnv && !apiKey) || !model.base_url) { reasons.push(`${model.key}: مفيش مفتاح`); continue; }
    if (agent.sensitive && model.trains_on_free_data) { reasons.push(`${model.key}: بيانات حساسة`); continue; }

    const endpoint = model.provider === "pollinations" ? `${model.base_url}/openai` : `${model.base_url}/chat/completions`;
    const started = Date.now();
    let status = "ok";
    let reply = "";
    let usage: { prompt_tokens?: number; completion_tokens?: number } = {};
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
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
    return json({ reply, model_key: model.key, used_fallback: index > 0 });
  }

  const hint = agent.sensitive
    ? " (الموظف ده شغال على بيانات عملاء وفلوس، فمابيستخدمش الموديل المجاني اللي من غير مفتاح. كلّمه بعد ما يتحط مفتاح Groq.)"
    : "";
  return fail(`${agent.name} مش قادر يرد دلوقتي — ${reasons.join("؛ ") || "مفيش موديل متاح"}${hint}`, 503);
});
