// ساعة الشركة: الفريق بيشتغل لوحده كل يوم من غير ما حد يقوله.
//
// pg_cron بينادي الدالة دي كل دقيقتين (بسر محفوظ في Supabase Vault). كل نداء بيعمل خطوة صغيرة بس
// (عشان يخلص في أقل من دقيقة ونفضل جوه حدود Groq المجانية)، والحالة كلها في قاعدة البيانات:
//
// - 8 الصبح بتوقيت القاهرة: اجتماع الصبح. نادر بيفتح بجدول الأعمال (توجيهات رئيس مجلس الإدارة والمهام)،
//   كل موظف بيتكلم عن شغله وممكن يقترح فكرة، سلمى بتنقد، ونادر بيقرر ويوزّع مهام بمواعيد.
// - 4 العصر: اجتماع آخر اليوم بنفس الطريقة: اتعمل إيه، واتأخر إيه، وبكرة هنعمل إيه.
// - طول اليوم (8 الصبح لـ 10 بالليل): أي مهمة جه ميعادها بتتسلّم، والنتيجة بتتكتب عليها.
// - كل ساعة من 9 لـ 4: الفريق بيكلّم بعض في «مكتب الفريق» (زميل بيسأل زميل أو بيسلّمه شغل).
//
// زرار «إيقاف الكل» بيوقف ده كله.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

const ZONE = "Africa/Cairo";
const MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
const SPEAKERS_PER_TICK = 2;
const TASKS_PER_TICK = 2;

type Json = Record<string, unknown>;
interface Agent { id: string; name: string; title: string; department: string; status: string; duties: string[]; instructions: string }
interface Task { id: number; agent_id: string; title: string; details: string | null; status: string; due_date: string | null; created_at: string; updated_at: string }

const clip = (t: unknown, n: number) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// ── الوقت بتوقيت القاهرة ─────────────────────────────────
function cairo(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}
const cairoDate = (iso: string) => cairo(new Date(iso)).date;
function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** «today» / «tomorrow» / «2026-11-20» / عدد أيام ← تاريخ */
function dueDate(due: unknown, today: string): string {
  const s = String(due ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s < today ? today : s;
  if (/tomorrow|بكر/.test(s)) return addDays(today, 1);
  const n = Number(s);
  if (Number.isFinite(n) && n > 0 && n < 60) return addDays(today, Math.round(n));
  return today;
}

// ── الموديل ──────────────────────────────────────────────
const secrets = new Map<string, string>();
async function secret(name: string): Promise<string | null> {
  if (secrets.has(name)) return secrets.get(name)!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/agent_secret`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ secret_name: name }),
  });
  const value = res.ok ? ((await res.json()) as string | null) : null;
  if (value) secrets.set(name, value);
  return value;
}

async function llm(
  db: SupabaseClient, agentId: string, messages: { role: string; content: string }[],
  opts: { json?: boolean; effort?: "low" | "medium" | "high"; max?: number } = {},
): Promise<string> {
  const key = await secret("GROQ_API_KEY");
  if (!key) throw new Error("مفيش مفتاح Groq");
  for (let attempt = 0; attempt < 2; attempt++) {
    let wait = 0;
    for (const model of MODELS) {
      const started = Date.now();
      const body: Json = {
        model, messages, temperature: 0.6,
        max_completion_tokens: (opts.max ?? 600) + (model.includes("gpt-oss") ? 1500 : 0),
        ...(model.includes("gpt-oss") ? { reasoning_effort: opts.effort ?? "medium" } : {}),
        ...(model.includes("qwen") ? { reasoning_format: "hidden" } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      };
      let status = "ok";
      let data: Json | null = null;
      try {
        let res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(body), signal: AbortSignal.timeout(50_000),
        });
        if (res.status === 400 && opts.json) {
          delete body.response_format;
          res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify(body), signal: AbortSignal.timeout(50_000),
          });
        }
        if (!res.ok) {
          status = res.status === 429 ? "rate_limited" : `http_${res.status}`;
          if (res.status === 429) wait = Math.max(wait, Number(res.headers.get("retry-after")) || 8);
        } else data = await res.json();
      } catch {
        status = "network_error";
      }
      const usage = (data?.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number };
      await db.from("llm_calls").insert({
        agent_id: agentId, provider: "groq", model_key: model.endsWith("120b") ? "groq:big" : model.includes("qwen") ? "groq:qwen" : "groq:small",
        model_id: model, is_fallback: model !== MODELS[0], status, latency_ms: Date.now() - started,
        prompt_tokens: usage.prompt_tokens ?? 0, completion_tokens: usage.completion_tokens ?? 0,
      });
      const text = String((data?.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? "").trim();
      if (text) return text;
    }
    if (!wait || wait > 25) break;
    await sleep((wait + 1) * 1000);
  }
  throw new Error("الموديلات مش متاحة دلوقتي");
}

function parse(text: string): Json {
  const m = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : text); } catch { return { say: text }; }
}
const spoken = (t: unknown) => clip(t, 1500).replace(/[*_#`>]/g, "");

// ── الشخصيات ─────────────────────────────────────────────
const REALITY =
  "الواقع الحقيقي للشركة: STRATIX بتصمم مواقع للمحلات والمطاعم في مصر (بنها وحواليها). كريم بيدوّر على محلات مالهاش موقع من الخريطة،" +
  " هاني بيرتّبهم، ليلى بتكتب رسايل واتساب، عمر بيتابع، ومنى خدمة العملاء. فريق الموقع (يوسف، زياد، رامي، نور) بيراقب stratix.website،" +
  " وأحمد ورنا التطوير والمراجعة، وطارق الحسابات، ومصطفى المشاريع، وسلمى الناقدة، ونادر المدير التنفيذي." +
  " مفيش قسم تسويق ولا ميزانية إعلانات ولا حملات سوشيال. الأسعار من 2000 لـ 3000 جنيه، وأي خصم أو سعر غيرها أو أي فلوس بتتصرف محتاجة موافقة رئيس مجلس الإدارة." +
  " ممنوع تألّف أرقام أو أحداث أو عملاء مش في البيانات. ممنوع تقول إنك ذكاء اصطناعي أو برنامج.";

function persona(a: Agent, facts: Json) {
  const mine = clip(facts[a.id] ?? facts[a.department] ?? "", 900);
  return `انت ${a.name}، ${a.title} في شركة STRATIX. رؤساء مجلس الإدارة وأصحاب الشركة: فارس ويوسف.\n` +
    `شغلك: ${(a.duties ?? []).join("، ")}\n${clip(a.instructions, 500)}\n` +
    `أرقامك الحقيقية: ${mine || "مفيش أرقام متسجلة عن شغلك."}\nأرقام الشركة: ${clip(facts._company, 500) || "-"}\n${REALITY}`;
}

// ── السياق المشترك ───────────────────────────────────────
async function context(db: SupabaseClient) {
  const [{ data: roster }, { data: factsRow }, { data: notes }] = await Promise.all([
    db.from("agents").select("id, name, title, department, status, duties, instructions").neq("status", "fired"),
    db.from("company_settings").select("value").eq("key", "latest_facts").maybeSingle(),
    db.from("chats").select("agent_id, content, created_at").eq("role", "owner")
      .gte("created_at", new Date(Date.now() - 3 * 86400_000).toISOString()).order("created_at", { ascending: false }).limit(20),
  ]);
  const agents = new Map(((roster ?? []) as Agent[]).map((a) => [a.id, a]));
  const names = (id: string) => agents.get(id)?.name ?? id;
  const directives = ((notes ?? []) as { agent_id: string; content: string }[])
    .map((c) => `- (لـ${names(c.agent_id)}) ${clip(c.content, 250)}`).join("\n");
  return { agents, names, facts: (factsRow?.value ?? {}) as Json, directives };
}
type Ctx = Awaited<ReturnType<typeof context>>;

const teamCodes = (ctx: Ctx) => [...ctx.agents.values()].map((a) => `${a.id}=${a.name}`).join("، ");

async function addTasks(db: SupabaseClient, ctx: Ctx, list: unknown, today: string, meetingId: number | null, source: string) {
  const rows = (Array.isArray(list) ? list : []).slice(0, 15)
    .map((t) => t as Json)
    .filter((t) => ctx.agents.has(String(t.agent_id)) && clip(t.title, 300))
    .map((t) => ({
      agent_id: String(t.agent_id), meeting_id: meetingId, title: clip(t.title, 300),
      details: `${source} ${clip(t.details, 1500)}`.trim(), status: "todo", due_date: dueDate(t.due, today),
    }));
  if (!rows.length) return 0;
  // نفس المهمة لنفس الموظف وهي لسه مفتوحة مابتتكررش
  const { data: open } = await db.from("tasks").select("agent_id, title").in("status", ["todo", "doing"]);
  const seen = new Set(((open ?? []) as { agent_id: string; title: string }[]).map((t) => `${t.agent_id}|${t.title}`));
  const fresh = rows.filter((r) => !seen.has(`${r.agent_id}|${r.title}`));
  if (fresh.length) await db.from("tasks").insert(fresh);
  return fresh.length;
}

// ── الاجتماع اليومي (خطوة في كل نداء) ─────────────────────
async function meetingStep(db: SupabaseClient, ctx: Ctx, kind: "morning" | "evening", today: string): Promise<string> {
  const { data: rows } = await db.from("meetings").select("id, status, started_at").eq("kind", kind)
    .gte("started_at", new Date(Date.now() - 36 * 3600_000).toISOString()).order("id", { ascending: false });
  const mine = ((rows ?? []) as { id: number; status: string; started_at: string }[]).filter((m) => cairoDate(m.started_at) === today);
  if (mine.some((m) => m.status === "done")) return "done";
  let meeting = mine.find((m) => m.status === "running");
  // اجتماع وقف في النص من أكتر من ساعتين: يتقفل ويبدأ من جديد
  if (meeting && Date.now() - Date.parse(meeting.started_at) > 2 * 3600_000) {
    await db.from("meetings").update({ status: "failed", summary: "اتقطع في النص", ended_at: new Date().toISOString() }).eq("id", meeting.id);
    meeting = undefined;
  }
  if (mine.filter((m) => m.status === "failed").length >= 3) return "gave-up";
  const ceo = ctx.agents.get("ceo");
  if (!ceo) return "no-ceo";
  const label = kind === "morning" ? "اجتماع الصبح" : "اجتماع آخر اليوم";

  const { data: openTasks } = await db.from("tasks").select("agent_id, title, status, due_date").in("status", ["todo", "doing"])
    .order("created_at").limit(40);
  const { data: doneToday } = await db.from("tasks").select("agent_id, title, result, completed_at").eq("status", "done")
    .gte("completed_at", new Date(Date.now() - 24 * 3600_000).toISOString()).limit(30);
  const taskLines = (list: unknown[], withResult = false) => ((list ?? []) as Json[])
    .map((t) => `- ${ctx.names(String(t.agent_id))}: ${clip(t.title, 120)}${t.due_date ? ` (ميعادها ${t.due_date})` : ""}` +
      (withResult ? ` ← ${clip(t.result, 160)}` : "")).join("\n");

  // ── بداية الاجتماع: نادر بيفتح بجدول الأعمال
  if (!meeting) {
    const { data: created } = await db.from("meetings").insert({ kind, status: "running", topic: label }).select("id, status, started_at").single();
    if (!created) return "insert-failed";
    meeting = created as { id: number; status: string; started_at: string };
    const open = await llm(db, "ceo", [
      { role: "system", content: persona(ceo, ctx.facts) + "\nاتكلم بالعامية المصرية زي مدير حقيقي بيفتح اجتماع مع فريقه. كلام عادي من غير عناوين ولا نجوم." },
      { role: "user", content: `افتح ${label} في 3 لـ 5 جمل: قول جدول الأعمال النهارده.\n` +
        `توجيهات رئيس مجلس الإدارة الأخيرة (أهم حاجة، لازم تتنفذ):\n${ctx.directives || "مفيش توجيهات جديدة"}\n` +
        `المهام المفتوحة:\n${taskLines(openTasks ?? []) || "مفيش"}\n` +
        (kind === "evening" ? `اللي اتسلّم النهارده:\n${taskLines(doneToday ?? [], true) || "مفيش"}\n` : "") },
    ], { effort: "medium", max: 400 });
    await db.from("messages").insert({ meeting_id: meeting.id, agent_id: "ceo", kind: "speech", content: spoken(open) });
    return "opened";
  }

  const { data: said } = await db.from("messages").select("agent_id, content, kind").eq("meeting_id", meeting.id).order("id");
  const transcript = ((said ?? []) as Json[]).map((m) => `${ctx.names(String(m.agent_id))}: ${clip(m.content, 350)}`).join("\n");
  const spokeIds = new Set(((said ?? []) as Json[]).map((m) => String(m.agent_id)));
  const queue = [...ctx.agents.values()].filter((a) => a.status === "active" && a.id !== "ceo" && a.id !== "critic" && !spokeIds.has(a.id));

  // ── الموظفين بيتكلموا (اتنين في كل نداء)
  if (queue.length) {
    let tail = transcript;
    for (const a of queue.slice(0, SPEAKERS_PER_TICK)) {
      const myTasks = ((openTasks ?? []) as Json[]).filter((t) => t.agent_id === a.id).map((t) => clip(t.title, 100)).join("، ");
      const myDone = ((doneToday ?? []) as Json[]).filter((t) => t.agent_id === a.id).map((t) => clip(t.title, 100)).join("، ");
      const out = parse(await llm(db, a.id, [
        { role: "system", content: persona(a, ctx.facts) + "\nانت في " + label + " مع زمايلك. اتكلم بالعامية المصرية زي موظف حقيقي، 2 لـ 4 جمل، من غير عناوين ولا نجوم. رد بـ JSON بس." },
        { role: "user", content: `الكلام لحد دلوقتي:\n${clip(tail, 5000)}\n\n` +
          `مهامك المفتوحة: ${myTasks || "مفيش"}\nاللي سلّمته آخر 24 ساعة: ${myDone || "مفيش"}\n` +
          (kind === "morning" ? "قول هتعمل إيه النهارده بالظبط ومحتاج إيه من مين (لو محتاج). " : "قول عملت إيه النهارده فعلًا، وإيه اللي اتأخر وليه، وبكرة هتعمل إيه. ") +
          "رد على زميل لو كلامه يخصك. ماتعيدش كلام اتقال: لو زميل قبلك طلب نفس الطلب أو قال نفس المعلومة (زي موافقة على الأسعار) ماتكررهاش،" +
          " وقول بس الحاجة الخاصة بشغلك انت اللي محدش قالها. لو عندك فكرة جديدة مفيدة فعلًا حطها في idea، وغير كده سيبها فاضية.\n" +
          '{"say": "كلامك", "idea": "فكرة أو فاضي"}' },
      ], { json: true, effort: "medium", max: 350 }));
      const text = spoken(out.say);
      if (!text) continue;
      const { data: msg } = await db.from("messages").insert({ meeting_id: meeting.id, agent_id: a.id, kind: "speech", content: text }).select("id").single();
      const idea = clip(out.idea, 600);
      if (idea && idea.length > 8) await db.from("proposals").insert({ meeting_id: meeting.id, agent_id: a.id, message_id: msg?.id ?? null, idea, status: "pending" });
      tail += `\n${a.name}: ${text}`;
    }
    return `spoke:${queue.length - Math.min(queue.length, SPEAKERS_PER_TICK)} left`;
  }

  // ── سلمى بتنقد مرة واحدة
  const critic = ctx.agents.get("critic");
  if (critic?.status === "active" && !spokeIds.has("critic")) {
    const out = await llm(db, "critic", [
      { role: "system", content: persona(critic, ctx.facts) + "\nانتي الناقدة: شغلك تمسكي الكلام الفاضي والوعود اللي مش هتتنفذ والأرقام اللي مالهاش أساس. عامية مصرية، 2 لـ 4 جمل، باحترام وبالأسماء." },
      { role: "user", content: `الاجتماع:\n${clip(transcript, 6000)}\n\nقولي أهم اعتراض أو خطر، ومين لازم يرد عليه.` },
    ], { effort: "medium", max: 300 });
    await db.from("messages").insert({ meeting_id: meeting.id, agent_id: "critic", kind: "objection", content: spoken(out) });
    return "critic";
  }

  // ── نادر بيقرر ويوزّع المهام ويقفل
  const { data: ideas } = await db.from("proposals").select("id, agent_id, idea").eq("meeting_id", meeting.id).eq("status", "pending");
  const ideaLines = ((ideas ?? []) as Json[]).map((p) => `#${p.id} من ${ctx.names(String(p.agent_id))}: ${clip(p.idea, 250)}`).join("\n");
  const decision = parse(await llm(db, "ceo", [
    { role: "system", content: persona(ceo, ctx.facts) + "\nانت المدير التنفيذي وبتقفل الاجتماع بقرارات حقيقية تتنفذ. رد بـ JSON بس." },
    { role: "user", content: `${label} كله:\n${clip(transcript, 7000)}\n\nتوجيهات رئيس مجلس الإدارة:\n${ctx.directives || "مفيش"}\n` +
      `الأفكار المقترحة:\n${ideaLines || "مفيش"}\nالمهام المفتوحة دلوقتي:\n${taskLines(openTasks ?? []) || "مفيش"}\n\n` +
      "1) say: ملخص الاجتماع بالفصحى البسيطة في 3 لـ 6 جمل (اتفقنا على إيه ومين هيعمل إيه).\n" +
      "2) ideas: لكل فكرة {\"id\": رقمها, \"approve\": true/false, \"reason\": السبب}. اقبل بس اللي في حدود القواعد ومفيدة فعلًا.\n" +
      "3) tasks: مهام جديدة واضحة يقدر الموظف يسلّمها كتابةً (تقرير، رسالة، خطة، مراجعة) [{\"agent_id\",\"title\",\"details\",\"due\": \"today\" أو \"tomorrow\" أو تاريخ YYYY-MM-DD}]." +
      " كل توجيه من رئيس مجلس الإدارة لسه ماتعملش لازم يبقى مهمة. ماتكررش مهمة مفتوحة.\n" +
      `أكواد الموظفين: ${teamCodes(ctx)}\n{"say": "...", "ideas": [], "tasks": []}` },
  ], { json: true, effort: "high", max: 1500 }));
  for (const d of (Array.isArray(decision.ideas) ? decision.ideas : []) as Json[]) {
    const id = Number(d.id);
    if (!((ideas ?? []) as Json[]).some((p) => Number(p.id) === id)) continue;
    await db.from("proposals").update({ status: d.approve ? "approved" : "rejected", ceo_reason: clip(d.reason, 500) || null }).eq("id", id);
  }
  const added = await addTasks(db, ctx, decision.tasks, today, meeting.id, `من ${label}.`);
  const summary = spoken(decision.say) || `اتقفل ${label}.`;
  await db.from("messages").insert({ meeting_id: meeting.id, agent_id: "ceo", kind: "decision",
    content: summary + (added ? `\n\nاتسجّل ${added} مهمة جديدة بمواعيدها.` : "") });
  await db.from("meetings").update({ status: "done", summary, ended_at: new Date().toISOString() }).eq("id", meeting.id);
  return `closed:+${added} tasks`;
}

// ── مكتب الفريق: سجل شغل اليوم وكلامهم مع بعض ─────────────
async function workroom(db: SupabaseClient, today: string): Promise<number> {
  const { data } = await db.from("meetings").select("id, started_at").eq("kind", "work")
    .gte("started_at", new Date(Date.now() - 36 * 3600_000).toISOString()).order("id", { ascending: false });
  const row = ((data ?? []) as { id: number; started_at: string }[]).find((m) => cairoDate(m.started_at) === today);
  if (row) return row.id;
  const { data: created } = await db.from("meetings").insert({ kind: "work", status: "done", topic: "مكتب الفريق" }).select("id").single();
  return (created as { id: number }).id;
}

// ── تسليم المهام اللي جه ميعادها ──────────────────────────
async function doTasks(db: SupabaseClient, ctx: Ctx, today: string): Promise<number> {
  // مهمة علقت في النص (النداء وقع) ترجع للطابور
  await db.from("tasks").update({ status: "todo" }).eq("status", "doing").lt("updated_at", new Date(Date.now() - 20 * 60_000).toISOString());
  const { data } = await db.from("tasks").select("*").eq("status", "todo")
    .or(`due_date.is.null,due_date.lte.${today}`).order("due_date", { ascending: true, nullsFirst: true }).order("created_at").limit(TASKS_PER_TICK);
  const tasks = (data ?? []) as Task[];
  if (!tasks.length) return 0;
  const room = await workroom(db, today);
  let done = 0;
  for (const t of tasks) {
    const a = ctx.agents.get(t.agent_id);
    if (!a || a.status !== "active") continue;
    const { data: claimed } = await db.from("tasks").update({ status: "doing" }).eq("id", t.id).eq("status", "todo").select("id");
    if (!claimed?.length) continue;
    try {
      const out = parse(await llm(db, a.id, [
        { role: "system", content: persona(a, ctx.facts) + "\nبتسلّم مهمة لرئيس مجلس الإدارة. رد بـ JSON بس." },
        { role: "user", content: `المهمة: «${t.title}»\n${clip(t.details, 1500)}\n\n` +
          "1) result: الناتج نفسه كامل بالفصحى وبأسلوب مهني (فقرة قصيرة ثم نقاط). اشتغل فعلًا: لو مطلوب رسالة اكتبها، لو خطة اكتبها بخطوات ومواعيد، لو تقرير اكتبه من الأرقام اللي عندك بس." +
          " لو حاجة مش في بياناتك أو صلاحياتك قول بوضوح إيه الناقص ومين يقدر يجيبه.\n" +
          "2) note: جملة عامية قصيرة بتقولها لزمايلك في مكتب الفريق إنك خلصت ولو محتاج حاجة من حد.\n" +
          `3) handoff: لو المهمة محتاجة زميل يكمّل بعدك: {"agent_id","title","details","due"} وغير كده null. أكواد الفريق: ${teamCodes(ctx)}\n` +
          '{"result": "...", "note": "...", "handoff": null}' },
      ], { json: true, effort: "high", max: 2200 }));
      const result = clip(out.result ?? out.say, 8000);
      if (!result) throw new Error("فاضي");
      await db.from("tasks").update({ status: "done", result, completed_at: new Date().toISOString() }).eq("id", t.id);
      await db.from("messages").insert({ meeting_id: room, agent_id: a.id, kind: "activity",
        content: `✔ سلّمت: ${clip(t.title, 160)}${out.note ? ` — ${spoken(out.note)}` : ""}` });
      if (out.handoff && typeof out.handoff === "object") await addTasks(db, ctx, [out.handoff], today, null, `تكملة لمهمة ${a.name} «${clip(t.title, 100)}».`);
      done++;
    } catch {
      await db.from("tasks").update({ status: "todo" }).eq("id", t.id);
    }
  }
  return done;
}

// ── الفريق بيكلّم بعض ─────────────────────────────────────
async function huddle(db: SupabaseClient, ctx: Ctx, today: string): Promise<string> {
  const room = await workroom(db, today);
  const { data: last } = await db.from("messages").select("created_at").eq("meeting_id", room).eq("kind", "speech")
    .order("id", { ascending: false }).limit(1);
  if (last?.length && Date.now() - Date.parse((last[0] as Json).created_at as string) < 55 * 60_000) return "recent";
  const { data: log } = await db.from("messages").select("agent_id, content").eq("meeting_id", room).order("id", { ascending: false }).limit(12);
  const { data: open } = await db.from("tasks").select("agent_id, title").in("status", ["todo", "doing"]).limit(30);
  const active = [...ctx.agents.values()].filter((a) => a.status === "active");
  // اللي عنده شغل مفتوح أو سلّم حاجة هو اللي يبدأ الكلام
  const busy = new Set([...(open ?? []), ...(log ?? [])].map((x) => String((x as Json).agent_id)));
  const pool = active.filter((a) => busy.has(a.id));
  const from = (pool.length ? pool : active)[Math.floor(Math.random() * (pool.length || active.length))];
  if (!from) return "nobody";
  const recent = ((log ?? []) as Json[]).reverse().map((m) => `${ctx.names(String(m.agent_id))}: ${clip(m.content, 200)}`).join("\n");
  const mineOpen = ((open ?? []) as Json[]).filter((t) => t.agent_id === from.id).map((t) => clip(t.title, 100)).join("، ");
  const first = parse(await llm(db, from.id, [
    { role: "system", content: persona(from, ctx.facts) + "\nانت في مكتب الفريق بتكلّم زميل في الشغل. عامية مصرية، جملة أو اتنين، زي واتساب الشغل. رد بـ JSON بس." },
    { role: "user", content: `آخر اللي اتقال في المكتب:\n${recent || "مفيش"}\nمهامك المفتوحة: ${mineOpen || "مفيش"}\n` +
      `كلّم زميل واحد بخصوص حاجة حقيقية في الشغل: تسأله عن حاجة محتاجها، أو تسلّمه حاجة، أو تنبّهه لمشكلة. أكواد الفريق: ${teamCodes(ctx)}\n` +
      '{"to": "كود الزميل", "say": "كلامك"}' },
  ], { json: true, effort: "low", max: 250 }));
  const to = ctx.agents.get(String(first.to));
  const text = spoken(first.say);
  if (!to || to.id === from.id || !text) return "skip";
  const { data: m1 } = await db.from("messages").insert({ meeting_id: room, agent_id: from.id, kind: "speech", content: text }).select("id").single();
  const answer = parse(await llm(db, to.id, [
    { role: "system", content: persona(to, ctx.facts) + "\nزميلك بيكلمك في مكتب الفريق. رد عليه بالعامية في جملة أو اتنين. رد بـ JSON بس." },
    { role: "user", content: `${from.name} قالك: «${text}»\n` +
      "رد عليه. لو هتعمل حاجة فعلًا سجّلها لنفسك في task {\"title\",\"details\",\"due\"} وغير كده null.\n" +
      '{"say": "ردك", "task": null}' },
  ], { json: true, effort: "low", max: 250 }));
  const reply = spoken(answer.say);
  if (reply) await db.from("messages").insert({ meeting_id: room, agent_id: to.id, kind: "speech", reply_to: m1?.id ?? null, content: reply });
  if (answer.task && typeof answer.task === "object") {
    await addTasks(db, ctx, [{ ...(answer.task as Json), agent_id: to.id }], today, null, `اتفق عليها مع ${from.name} في مكتب الفريق.`);
  }
  return `${from.id}->${to.id}`;
}

// ── النداء ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const expected = await secret("CLOCK_SECRET");
  if (!expected || req.headers.get("x-clock-secret") !== expected) return json({ error: "forbidden" }, 403);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: state } = await db.from("system_state").select("halted").eq("id", 1).maybeSingle();
  if (!state || state.halted) return json({ skipped: "halted" });

  // نداء واحد بس في نفس الوقت
  const { data: lock } = await db.from("company_settings").select("value").eq("key", "clock_lock").maybeSingle();
  const lockedAt = Number((lock?.value as Json | undefined)?.at ?? 0);
  if (Date.now() - lockedAt < 150_000) return json({ skipped: "busy" });
  await db.from("company_settings").upsert({ key: "clock_lock", value: { at: Date.now() } });

  await db.from("company_settings").upsert({ key: "clock_seen", value: { at: new Date().toISOString() } });
  const now = cairo();
  const body = await req.json().catch(() => ({})) as Json;
  const log: string[] = [];
  try {
    const ctx = await context(db);
    const force = String(body.force ?? "");
    if (force === "morning" || force === "evening") {
      log.push(`${force}:${await meetingStep(db, ctx, force, now.date)}`);
    } else if (now.hour >= 8 && now.hour < 22) {
      let busy = false;
      if (now.hour >= 16) {
        const r = await meetingStep(db, ctx, "evening", now.date);
        log.push(`evening:${r}`);
        busy = !["done", "gave-up", "no-ceo"].includes(r);
      } else {
        const r = await meetingStep(db, ctx, "morning", now.date);
        log.push(`morning:${r}`);
        busy = !["done", "gave-up", "no-ceo"].includes(r);
      }
      if (!busy) {
        const n = await doTasks(db, ctx, now.date);
        log.push(`tasks:${n}`);
        if (!n && now.hour >= 9 && now.hour < 16) log.push(`huddle:${await huddle(db, ctx, now.date)}`);
      }
    } else log.push("off-hours");
  } catch (e) {
    log.push(`error:${(e as Error).message}`);
  } finally {
    await db.from("company_settings").upsert({ key: "clock_lock", value: { at: 0 } });
  }
  return json({ at: now, log });
});
