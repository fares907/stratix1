// الاجتماع اللايف: رئيس مجلس الإدارة بيعمل اجتماع مع الفريق كله ويتكلم معاهم.
//
// action = "start": يبدأ اجتماع (موضوع + مدة بالدقايق)، ونادر يفتحه.
// action = "say":   رئيس مجلس الإدارة يقول حاجة. اللي اتنادى باسمه يرد، ولو كمّل مع نفس الشخص الحوار يكمل،
//                   وغير كده نادر يرد ويسيب اللي يخصه الكلام يرد. كله بيتكتب في messages فيظهر لايف.
// action = "close": نادر يقفل الاجتماع بملخص وقرارات ومهام بتتنفّذ في أول تشغيل.
//
// كل الكتابة بجلسة رئيس مجلس الإدارة نفسه (RLS)، والموديل Groq بمفتاح من Supabase Vault.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

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

// ردّ طبيعي (نص عادي، مش JSON): الكلام بيطلع أطبع بكتير
async function talk(
  db: SupabaseClient, agentId: string, messages: { role: string; content: string }[], maxTokens: number,
): Promise<string> {
  const k = await key();
  for (let attempt = 0; attempt < 3; attempt++) {
    let wait = 0;
    for (const model of MODELS) {
      const started = Date.now();
      let status = "ok";
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model, messages, temperature: 0.8, max_completion_tokens: maxTokens + 600, reasoning_effort: "low",
          }),
          signal: AbortSignal.timeout(45_000),
        });
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
        const text = cleanReply(String(data?.choices?.[0]?.message?.content ?? ""));
        if (text) return text;
      } catch {
        continue;
      }
    }
    if (!wait || wait > 40) break;
    await sleep((wait + 1) * 1000);
  }
  throw new Error("الموديلات مش متاحة دلوقتي");
}

// الموديل أحيانًا بيكتب اسمه في الأول أو بيحط علامات؛ الكلام المنطوق مايبقاش فيه كده
function cleanReply(text: string) {
  return text
    .replace(/^\s*[\p{L} ]{2,20}:\s*/u, (m) => (/[\u0600-\u06FF]/.test(m) && m.length < 22 ? "" : m))
    .replace(/[*_#`>]/g, "")
    .replace(/^["«]|["»]$/g, "")
    .trim();
}

// ── منع التكرار: لو الرد شبه حاجة اتقالت قبل كده، بيتكتب من جديد ──
const words = (t: string) => new Set(t.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
function similar(a: string, b: string) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}
const repeats = (reply: string, before: string[], limit = 0.6) => before.some((b) => similar(reply, b) > limit);
// «تمام» و«ماشي» و«شكرًا»: مش سؤال ومش محتاج رد
const ACK = /^(تمام|ماشي|اوك[يى]?|أوك[يى]?|ok|okay|شكرا|شكرًا|متشكر|حلو|جميل|طيب|خلاص|ماشي يا [^\s]+|تمام يا [^\s]+|تمام كده|ماشي كده|اتفقنا|فهمت|عظيم|ممتاز|برافو)[\s.!،,]*(تمام|ماشي|شكرا|شكرًا|كده)?[\s.!،,]*$/i;
// الموظف قال إنه مفيش عنده إضافة
const NOTHING = /^(لا|لأ|مفيش|لا شيء|-)[.!،\s]*$/;

// مين اتكلم معاه رئيس مجلس الإدارة بالاسم («يا طارق»، «طارق قولي…»)
function addressed(text: string, agents: Map<string, Agent>): string[] {
  const hits: { id: string; at: number }[] = [];
  for (const a of agents.values()) {
    const re = new RegExp(`(^|[\\s،,.!؟?«"(])(يا\\s*)?(أ|ا)?${a.name.replace(/^[أا]/, "")}(?=$|[\\s،,.!؟?»")])`);
    const m = re.exec(text);
    // «أنا يوسف» ده رئيس مجلس الإدارة بيعرّف نفسه، مش بينادي حد
    if (m && !/(أنا|انا)\s*$/.test(text.slice(0, m.index + m[1].length))) hits.push({ id: a.id, at: m.index });
  }
  return hits.sort((x, y) => x.at - y.at).map((h) => h.id);
}
const GROUP = /(يا\s*جماعة|يا\s*شباب|كلكم|كله(م)?\s|الفريق كله|حد فيكم|مين فيكم)/;

// أسلوب الكلام: زي زميل مصري حقيقي في اجتماع، مش زي برنامج
const HUMAN = [
  "اتكلم بالعامية المصرية الطبيعية زي ما الموظفين بيتكلموا فعلًا في اجتماع مع صاحب الشركة.",
  "جملة أو اتنين بس، كلام شفهي بيتقال بصوت: من غير نقط ولا عناوين ولا ترقيم ولا رموز.",
  "رد على اللي اتقال بالظبط، وابدأ بالمهم على طول، من غير مقدمات زي «بالتأكيد» أو «سؤال ممتاز» أو «يسعدني».",
  "خاطبه بـ«يا فندم» أو «حضرتك» من غير مبالغة، وماتكررش اسمه في كل جملة.",
  "عادي تقول «بصراحة» أو «بص يا فندم» أو «لا، الصراحة مش متأكد»، وعادي تسأل سؤال قصير لو محتاج توضيح.",
  "ماتعيدش كلام زميلك، وماتعيدش حاجة انت قلتها قبل كده في الاجتماع، وماتعيدش الأرقام لو اتقالت.",
  "جاوب على اللي اتسأل بس؛ ماتتطوعش بمعلومات أو تقارير ماحدش طلبها.",
  "ده حوار مستمر: افتكر اللي اتقال قبل كده واتكلم على أساسه، زي ما الناس بتتكلم مع بعض.",
  "ممنوع تقول إنك ذكاء اصطناعي أو موديل أو برنامج.",
].join(" ");

// الواقع الحقيقي للشركة: عشان محدش يتكلم عن حاجات مش موجودة
const REALITY =
  "الواقع الحقيقي للشركة دلوقتي: كريم (الكشّاف) بيدوّر على محلات ومطاعم في بنها مالهاش موقع من الخريطة،" +
  " وهاني بيرتّبهم، وليلى بتكتب رسايل واتساب، وعمر بيتابعها. مفيش قسم تسويق ولا ميزانية إعلانات ولا حملات سوشيال ميديا،" +
  " ومفيش قاعدة عملاء قديمة، والإيميل لسه مش متفعّل. الأسعار من 2000 لـ 3000 جنيه وأي خصم أو سعر غيرها محتاج موافقة رئيس مجلس الإدارة." +
  " ماتقولش إننا بنعمل حاجة مش في الواقع ده؛ لو بتقترح حاجة جديدة قول إنها اقتراح محتاج موافقته." +
  " ماتعيدش الأسعار في كل رد؛ قولها بس لو اتسألت عنها.";

function persona(a: Agent, facts: Record<string, string>, rules: string) {
  return `انت ${a.name}، ${a.title} في شركة STRATIX (تصميم مواقع للمحلات والمطاعم في مصر).\n` +
    `أصحاب الشركة ورؤساء مجلس الإدارة: فارس ويوسف، وواحد منهم معاك في الاجتماع دلوقتي. كلامه أوامر.\n` +
    `شغلك: ${(a.duties ?? []).join("، ")}\n` +
    `بياناتك الحقيقية (مرجع ليك؛ ماتقولش منها غير اللي اتسألت عنه بالظبط): ${clip(facts[a.id] ?? facts[a.department] ?? "مفيش", 1500)}\n${rules}\n` +
    `${HUMAN}\n${REALITY}\n` +
    "لو حاجة مش عندك قول كده ببساطة. ممنوع تألّف أرقام أو أحداث.";
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
      const open = await talk(db, "ceo", [
        { role: "system", content: persona(ceo, facts, rules) +
          "\nرئيس مجلس الإدارة لسه فاتح اجتماع. رحّب بيه في جملة واحدة قصيرة واسأله عايز نبدأ بإيه." +
          " ماتقولش أرقام ولا خطط ولا توزيع مهام." },
        { role: "user", content: `رئيس مجلس الإدارة: يلا نبدأ اجتماع عن «${topic}».` },
      ], 120);
      await db.from("messages").insert({ meeting_id: meeting.id, agent_id: "ceo", kind: "speech", content: open });
    } catch { /* الاجتماع بدأ حتى لو الافتتاح مانجحش */ }
    return json({ meeting_id: meeting.id, ends_at: endsAt });
  }

  const meetingId = Number(body.meeting_id);
  const { data: meeting } = await db.from("meetings").select("*").eq("id", meetingId).maybeSingle();
  if (!meeting || meeting.kind !== "live") return fail("الاجتماع ده مش موجود", 404);
  if (meeting.status !== "running") return fail("الاجتماع ده خلص", 409);

  const { data: history } = await db.from("messages").select("id, agent_id, author, content, kind")
    .eq("meeting_id", meetingId).order("id", { ascending: false }).limit(80);
  (history as Msg[] | null)?.reverse();
  const transcript = (history as Msg[] ?? []).map((m) =>
    `${m.author === "chairman" ? "رئيس مجلس الإدارة" : agents.get(m.agent_id ?? "")?.name ?? "؟"}: ${clip(m.content, 400)}`).join("\n");

  // ── رئيس مجلس الإدارة بيتكلم ─────────────────────────────
  // زي اجتماع حقيقي: اللي اتنادى باسمه هو اللي يرد، ولو كمّل كلامه مع نفس الشخص الحوار يكمل معاه،
  // ونادر بيرد لو الكلام عام أو موجّه له. كل واحد بيشوف الحوار كله كمحادثة، ومفيش تكرار.
  if (body.action === "say") {
    const text = clip(String(body.text || ""), 2000);
    const voice = body.voice === true;
    const maxResponders = voice ? 2 : 3;
    const maxTokens = voice ? 140 : 260;
    if (!text) return fail("اكتب رسالتك");
    const rows = (history as Msg[] ?? []);
    const { data: said } = await db.from("messages").insert({
      meeting_id: meetingId, agent_id: null, author: "chairman", kind: "speech", content: text,
    }).select("id").single();
    rows.push({ id: said?.id ?? 0, agent_id: null, author: "chairman", content: text, kind: "speech" });

    // «تمام» و«ماشي» في الاجتماع مش محتاجين رد: محدش يعيد كلامه
    if (ACK.test(text.trim())) return json({ ok: true, responders: [] });

    // مين يرد؟
    const active = (id: string) => agents.get(id)?.status === "active" || id === "ceo";
    let responders = addressed(text, agents).filter(active).slice(0, maxResponders);
    let ceoRoutes = false;
    if (!responders.length) {
      // بيكمّل كلامه مع آخر حد رد عليه (من غير ما يقول اسمه تاني)
      const before = rows.slice(0, -1);
      const lastChair = before.map((m) => m.author === "chairman").lastIndexOf(true);
      const lastSpeakers = before.slice(lastChair + 1).map((m) => m.agent_id).filter((x): x is string => Boolean(x));
      const last = lastSpeakers[lastSpeakers.length - 1];
      if (!GROUP.test(text) && last && lastChair >= 0 && new Set(lastSpeakers).size === 1) responders = [last];
      else { responders = ["ceo"]; ceoRoutes = true; }
    }

    const asChat = (selfId: string) => rows.slice(-40).map((m) => {
      if (m.agent_id === selfId) return { role: "assistant", content: m.content };
      const who = m.author === "chairman" ? "رئيس مجلس الإدارة" : agents.get(m.agent_id ?? "")?.name ?? "؟";
      return { role: "user", content: `${who}: ${m.content}` };
    });

    const spoken: string[] = [];
    // addOn: موظف بيكمّل بعد زميله؛ لازم يضيف جديد، ولو كلامه شبه اللي اتقال مابيتقالش أصلًا
    const reply = async (id: string, cue: string, addOn = false): Promise<string | null> => {
      const a = agents.get(id)!;
      const own = rows.filter((m) => m.agent_id === id).map((m) => m.content);
      const system = persona(a, facts, rules) + `\nانت في اجتماع لايف (الموضوع: ${meeting.topic}). ${cue}` +
        (voice ? " ده كلام بالصوت في مكالمة: جملة أو اتنين بالكتير." : " ردك قصير: جملتين أو تلاتة بالكتير.");
      const msgs = [{ role: "system", content: system }, ...asChat(id)];
      const limit = addOn ? 0.4 : 0.6;
      let out = await talk(db, id, msgs, maxTokens);
      if (addOn && NOTHING.test(out)) return null;
      if (repeats(out, own) || repeats(out, spoken, limit)) {
        out = await talk(db, id, [...msgs, { role: "user", content:
          "(ملحوظة من نظام الاجتماع: ردك ده تكرار لحاجة اتقالت. قول حاجة جديدة ترد بيها على آخر كلام بس" +
          (addOn ? "، ولو مفيش عندك إضافة حقيقية رد بكلمة واحدة: لا.)" : "، أو لو مفيش جديد قول كده في كلمتين.)") }], maxTokens);
        if (addOn && (NOTHING.test(out) || repeats(out, spoken, limit))) return null;
      }
      const { data: row } = await db.from("messages").insert({
        meeting_id: meetingId, agent_id: id, kind: "speech", reply_to: said?.id, content: out,
      }).select("id").single();
      rows.push({ id: row?.id ?? 0, agent_id: id, author: null, content: out, kind: "speech" });
      spoken.push(out);
      return out;
    };

    try {
      if (ceoRoutes) {
        // نادر بيرد، ولو الكلام محتاج حد معين بيسيبه يرد (زي مدير حقيقي)
        let handoff: string[] = [];
        try {
          const route = await think(db, "ceo", "انت بتوزّع الكلام في اجتماع. رد بـ JSON بس.",
            `آخر كلام رئيس مجلس الإدارة: «${text}». مين لازم يرد عليه غير المدير التنفيذي؟ ` +
            `حط في "ask" أكواد اللي الكلام يخصهم فعلًا (غالبًا ولا حد أو واحد، لحد ${maxResponders})، من دول: ${teamList}`);
          handoff = (Array.isArray(route.ask) ? route.ask : []).map(String)
            .filter((id) => id !== "ceo" && agents.has(id) && active(id)).slice(0, voice ? 1 : 2);
        } catch { /* نادر يرد لوحده */ }
        const names = handoff.map((id) => agents.get(id)!.name).join(" و");
        await reply("ceo", handoff.length
          ? `رئيس مجلس الإدارة لسه قايل كلام يخص شغل ${names} كمان: رد عليه انت باختصار (جملة أو اتنين) بالأهم، ومن غير ما تتكلم بالنيابة عنهم.`
          : "رئيس مجلس الإدارة بيكلمك انت. رد عليه على اللي قاله بالظبط.");
        const spokeAfter: string[] = [];
        for (const id of handoff) {
          const said2 = await reply(id, "رئيس مجلس الإدارة سأل في حاجة تخصك ونادر سابك ترد." +
            " ضيف حاجة جديدة من شغلك انت (حاجة انت هتعملها أو معلومة من بياناتك) غير اللي اتقال؛" +
            " ماتعيدش كلام نادر ولا زمايلك. لو مفيش عندك إضافة حقيقية رد بكلمة واحدة: لا.", true);
          if (said2) spokeAfter.push(id);
        }
        responders = ["ceo", ...spokeAfter];
      } else {
        for (const id of responders) {
          await reply(id, responders.length > 1
            ? "رئيس مجلس الإدارة بيكلمك انت وزمايلك اللي ناداهم بالاسم. رد على الجزء اللي يخصك انت بس."
            : "رئيس مجلس الإدارة بيكلمك انت شخصيًا. رد عليه على اللي قاله بالظبط، زي ما بتكلمه وش لوش.");
        }
      }
    } catch (e) {
      return fail(`الفريق مش قادر يرد دلوقتي: ${(e as Error).message}`, 503);
    }
    return json({ ok: true, responders });
  }

  // ── إنهاء الاجتماع ───────────────────────────────────────
  if (body.action === "close") {
    let decision: Record<string, unknown>;
    try {
      decision = await think(db, "ceo", persona(ceo, facts, rules),
      `ده الاجتماع اللايف مع رئيس مجلس الإدارة كله (الموضوع: ${meeting.topic}):\n${transcript}\n\n` +
      "اقفل الاجتماع: في \"say\" ملخص قصير (3 لـ 5 جمل) باللي اتقال واتفقنا عليه فعلًا في الاجتماع ده بس،" +
      " وفي \"tasks\" قائمة [{\"agent_id\":..., \"title\":..., \"details\":...}] بالحاجات اللي رئيس مجلس الإدارة طلبها" +
      " أو وافق عليها صراحةً بس. أي اقتراح ماوافقش عليه مايبقاش مهمة، وأي حاجة مش في الواقع الحقيقي للشركة ماتتكتبش." +
      ` أكواد الموظفين: ${teamList}`);
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
