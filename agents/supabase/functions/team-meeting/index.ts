// الاجتماع اللايف: رئيس مجلس الإدارة بيعمل اجتماع مع الفريق كله ويتكلم معاهم.
//
// action = "start": يبدأ اجتماع (موضوع + مدة بالدقايق)، ونادر يفتحه.
// action = "say":   رئيس مجلس الإدارة يقول حاجة؛ نادر يرد ويحدد مين من الفريق يرد (لحد 4)،
//                   وكل واحد منهم يرد من بياناته الحقيقية. كله بيتكتب في messages فيظهر لايف.
// action = "close": نادر يقفل الاجتماع بملخص وقرارات ومهام بتتنفّذ في أول تشغيل.
//
// كل الكتابة بجلسة رئيس مجلس الإدارة نفسه (RLS)، والموديل Groq بمفتاح من Supabase Vault.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const MAX_RESPONDERS = 4;
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string, status = 400) => json({ error }, status);
const clip = (t: string | null | undefined, n: number) => (t ?? "").replace(/\s+/g, " ").slice(0, n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Agent { id: string; name: string; title: string; department: string; status: string; duties: string[]; tools: string[] }
interface Msg { id: number; agent_id: string | null; author: string | null; content: string; kind: string }

let groqKey: string | null = null;
async function key(): Promise<string> {
  if (groqKey) return groqKey;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/agent_secret`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ secret_name: "GROQ_API_KEY" }),
  });
  groqKey = res.ok ? ((await res.json()) as string) : null;
  if (!groqKey) throw new Error("مفيش مفتاح Groq");
  return groqKey;
}

async function think(db: SupabaseClient, agentId: string, system: string, prompt: string): Promise<Record<string, unknown>> {
  const k = await key();
  const messages = [{ role: "system", content: system }, { role: "user", content: prompt }];
  const post = (body: Record<string, unknown>) =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  // لو Groq طلب انتظار قصير (الفريق كله بيسأل مرة واحدة) نستنى ونعيد
  for (let attempt = 0; attempt < 3; attempt++) {
    let wait = 0;
    for (const model of MODELS) {
      const started = Date.now();
      let status = "ok";
      try {
        let res = await post({ model, temperature: 0.5, response_format: { type: "json_object" }, messages });
        // Groq بيرفض بـ 400 لو الموديل طلّع JSON مش سليم؛ نعيد من غير json_mode
        if (res.status === 400) res = await post({ model, temperature: 0.5, messages });
        if (!res.ok) {
          status = res.status === 429 ? "rate_limited" : `http_${res.status}`;
          if (res.status === 429) wait = Math.max(wait, Number(res.headers.get("retry-after")) || 5);
        }
        const data = res.ok ? await res.json() : null;
        await db.from("llm_calls").insert({
          agent_id: agentId, provider: "groq", model_key: model.endsWith("120b") ? "groq:big" : "groq:small",
          model_id: model, is_fallback: model !== MODELS[0], status, latency_ms: Date.now() - started,
          prompt_tokens: data?.usage?.prompt_tokens ?? 0, completion_tokens: data?.usage?.completion_tokens ?? 0,
        });
        if (!data) continue;
        const content = String(data.choices?.[0]?.message?.content ?? "");
        try { return JSON.parse(content); } catch { return { say: content }; }
      } catch {
        continue;
      }
    }
    if (!wait || wait > 40) break;
    await sleep((wait + 1) * 1000);
  }
  throw new Error("الموديلات مش متاحة دلوقتي");
}

// أسلوب الكلام: زي زميل مصري حقيقي في اجتماع، مش زي برنامج
const HUMAN = [
  "اتكلم بالعامية المصرية الطبيعية زي ما الموظفين بيتكلموا فعلًا في اجتماع مع صاحب الشركة.",
  "جملة أو اتنين بس، كلام شفهي بيتقال بصوت: من غير نقط ولا عناوين ولا ترقيم ولا رموز.",
  "رد على اللي اتقال بالظبط، وابدأ بالمهم على طول، من غير مقدمات زي «بالتأكيد» أو «سؤال ممتاز» أو «يسعدني».",
  "خاطبه بـ«يا فندم» أو «حضرتك» من غير مبالغة، وماتكررش اسمه في كل جملة.",
  "عادي تقول «بصراحة» أو «بص يا فندم» أو «لا، الصراحة مش متأكد»، وعادي تسأل سؤال قصير لو محتاج توضيح.",
  "ماتعيدش كلام زميلك، وماتعيدش الأرقام لو اتقالت قبلك.",
  "ممنوع تقول إنك ذكاء اصطناعي أو موديل أو برنامج.",
].join(" ");

function persona(a: Agent, facts: Record<string, string>, rules: string) {
  return `انت ${a.name}، ${a.title} في شركة STRATIX (تصميم مواقع للمحلات والمطاعم في مصر).\n` +
    `أصحاب الشركة ورؤساء مجلس الإدارة: فارس ويوسف، وواحد منهم معاك في الاجتماع دلوقتي. كلامه أوامر.\n` +
    `شغلك: ${(a.duties ?? []).join("، ")}\n` +
    `بياناتك الحقيقية: ${clip(facts[a.id] ?? facts[a.department] ?? "مفيش", 1500)}\n${rules}\n` +
    `${HUMAN}\n` +
    "اتكلم من بياناتك بس. لو حاجة مش عندك قول كده ببساطة. ممنوع تألّف أرقام أو أحداث. رد بـ JSON فيه \"say\".";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("POST only", 405);
  const body = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });

  const { data: state } = await db.from("system_state").select("halted").eq("id", 1).maybeSingle();
  if (!state) return fail("مش مسموحلك", 403);
  if (state.halted) return fail("الشركة واقفة (إيقاف الكل) — شغّلها الأول", 423);

  const [{ data: roster }, { data: factsRow }, { data: rulesRow }] = await Promise.all([
    db.from("agents").select("id, name, title, department, status, duties, tools").neq("status", "fired"),
    db.from("company_settings").select("value").eq("key", "latest_facts").maybeSingle(),
    db.from("company_settings").select("value").eq("key", "rules").maybeSingle(),
  ]);
  const agents = new Map((roster as Agent[] ?? []).map((a) => [a.id, a]));
  const ceo = agents.get("ceo");
  if (!ceo) return fail("مفيش مدير تنفيذي", 400);
  const facts = (factsRow?.value ?? {}) as Record<string, string>;
  const r = (rulesRow?.value ?? {}) as { pricing?: { min?: number; max?: number } };
  const rules = `الأسعار المسموحة من ${r.pricing?.min ?? 2000} لـ ${r.pricing?.max ?? 3000} جنيه.`;
  const teamList = [...agents.values()].map((a) => `${a.id}=${a.name} (${a.title})`).join("، ");

  // ── بدء الاجتماع ─────────────────────────────────────────
  if (body.action === "start") {
    const minutes = Math.min(Math.max(Number(body.minutes) || 15, 5), 120);
    const topic = clip(String(body.topic || "اجتماع طارئ مع رئيس مجلس الإدارة"), 300);
    const endsAt = new Date(Date.now() + minutes * 60_000).toISOString();
    const { data: meeting, error } = await db.from("meetings").insert({
      kind: "live", status: "running", topic, ends_at: endsAt,
    }).select("id").single();
    if (error || !meeting) return fail("ماقدرتش أبدأ الاجتماع", 500);
    try {
      const open = await think(db, "ceo", persona(ceo, facts, rules),
        `رئيس مجلس الإدارة طلب اجتماع لايف دلوقتي مع الفريق كله لمدة ${minutes} دقيقة. الموضوع: «${topic}».\n` +
        "افتح الاجتماع في سطرين: رحّب بيه، وقول إن الفريق كله موجود ومستني كلامه.");
      await db.from("messages").insert({ meeting_id: meeting.id, agent_id: "ceo", kind: "speech", content: String(open.say ?? "") });
    } catch { /* الاجتماع بدأ حتى لو الافتتاح مانجحش */ }
    return json({ meeting_id: meeting.id, ends_at: endsAt });
  }

  const meetingId = Number(body.meeting_id);
  const { data: meeting } = await db.from("meetings").select("*").eq("id", meetingId).maybeSingle();
  if (!meeting || meeting.kind !== "live") return fail("الاجتماع ده مش موجود", 404);
  if (meeting.status !== "running") return fail("الاجتماع ده خلص", 409);

  const { data: history } = await db.from("messages").select("id, agent_id, author, content, kind")
    .eq("meeting_id", meetingId).order("id").limit(60);
  const transcript = (history as Msg[] ?? []).map((m) =>
    `${m.author === "chairman" ? "رئيس مجلس الإدارة" : agents.get(m.agent_id ?? "")?.name ?? "؟"}: ${clip(m.content, 400)}`).join("\n");

  // ── رئيس مجلس الإدارة بيتكلم ─────────────────────────────
  if (body.action === "say") {
    const text = clip(String(body.text || ""), 2000);
    // في المكالمة الصوتية: رد أقصر وناس أقل، عشان الكلام يبقى زي المكالمة الحقيقية
    const voice = body.voice === true;
    const maxResponders = voice ? 2 : MAX_RESPONDERS;
    if (!text) return fail("اكتب رسالتك");
    const { data: said } = await db.from("messages").insert({
      meeting_id: meetingId, agent_id: null, author: "chairman", kind: "speech", content: text,
    }).select("id").single();

    let lead: Record<string, unknown>;
    try {
      lead = await think(db, "ceo", persona(ceo, facts, rules),
      `ده الاجتماع لحد دلوقتي (الموضوع: ${meeting.topic}):\n${transcript}\n\nرئيس مجلس الإدارة قال دلوقتي: «${text}»\n\n` +
      "رد عليه في \"say\" (انت اللي بتدير الاجتماع؛ لو السؤال ليك جاوبه انت، ولو يخص حد معين قول إنك هتسيبه يرد)،" +
      ` وفي "ask" حط أكواد الموظفين اللي لازم يردّوا فعلًا (لحد ${maxResponders}، وغالبًا واحد أو ولا حد)، من دول: ${teamList}` +
      (voice ? "\nده كلام بالصوت في مكالمة: ردك جملة أو اتنين بالكتير." : ""));
    } catch (e) {
      return fail(`نادر مش قادر يرد دلوقتي: ${(e as Error).message}`, 503);
    }
    const { data: leadMsg } = await db.from("messages").insert({
      meeting_id: meetingId, agent_id: "ceo", kind: "speech", reply_to: said?.id, content: String(lead.say ?? ""),
    }).select("id").single();

    const ask = (Array.isArray(lead.ask) ? lead.ask : []).map(String)
      .filter((id) => id !== "ceo" && agents.get(id)?.status === "active").slice(0, maxResponders);
    let soFar = `${transcript}\nرئيس مجلس الإدارة: ${text}\nنادر: ${lead.say}`;
    for (const id of ask) {
      const a = agents.get(id)!;
      try {
        const reply = await think(db, id, persona(a, facts, rules),
          `انت في اجتماع لايف مع رئيس مجلس الإدارة والفريق (الموضوع: ${meeting.topic}).\n${soFar}\n\n` +
          `رئيس مجلس الإدارة قال: «${text}»، ونادر طلب منك ترد. رد في اللي يخص شغلك انت بس، من بياناتك انت` +
          (voice ? "، في جملة أو اتنين زي ما بتتكلم في مكالمة." : "، في جملتين أو تلاتة بالكتير."));
        await db.from("messages").insert({
          meeting_id: meetingId, agent_id: id, kind: "speech", reply_to: said?.id, content: String(reply.say ?? ""),
        });
        soFar += `\n${a.name}: ${reply.say}`;
      } catch { /* موظف واحد وقع مايوقفش الاجتماع */ }
    }
    return json({ ok: true, lead_message: leadMsg?.id, responders: ask });
  }

  // ── إنهاء الاجتماع ───────────────────────────────────────
  if (body.action === "close") {
    let decision: Record<string, unknown>;
    try {
      decision = await think(db, "ceo", persona(ceo, facts, rules),
      `ده الاجتماع اللايف مع رئيس مجلس الإدارة كله (الموضوع: ${meeting.topic}):\n${transcript}\n\n` +
      "اقفل الاجتماع: في \"say\" ملخص القرارات في 5 سطور، وفي \"tasks\" قائمة" +
      ` [{"agent_id":..., "title":..., "details":...}] بكل حاجة رئيس مجلس الإدارة طلبها أو اتقررت، من دول: ${teamList}`);
    } catch (e) {
      return fail(`نادر مش قادر يقفل الاجتماع دلوقتي، جرّب تاني بعد دقيقة: ${(e as Error).message}`, 503);
    }
    const tasks = (Array.isArray(decision.tasks) ? decision.tasks : []) as { agent_id?: string; title?: string; details?: string }[];
    const valid = tasks.filter((t) => t.agent_id && agents.has(t.agent_id) && t.title).slice(0, 15);
    if (valid.length) {
      await db.from("tasks").insert(valid.map((t) => ({
        agent_id: t.agent_id, meeting_id: meetingId, title: clip(t.title, 300),
        details: `من الاجتماع اللايف مع رئيس مجلس الإدارة. ${clip(t.details, 1500)}`, status: "todo",
      })));
    }
    const summary = String(decision.say ?? "");
    await db.from("messages").insert({ meeting_id: meetingId, agent_id: "ceo", kind: "decision", content: summary });
    await db.from("meetings").update({ status: "done", summary, ended_at: new Date().toISOString() }).eq("id", meetingId);
    return json({ ok: true, summary, tasks: valid.length });
  }

  return fail("action لازم يكون start أو say أو close");
});
