// الشات بين رئيس مجلس الإدارة وأي موظف (من صفحة "كلّم الموظفين" في اللوحة).
//
// - verify_jwt: لازم جلسة Supabase سليمة، وكل الاستعلامات بتتعمل بجلسة المستخدم نفسه،
//   فـ RLS بيمنع أي حد مش رئيس مجلس الإدارة.
// - الموظف بيرد من اللي متسجل فعلًا: الأرقام الحقيقية، كلام رئيس مجلس الإدارة، كلامه وأسبابه
//   في الاجتماعات، الأفكار وقرارات المدير، مهامه، آخر اجتماع، وآخر تقرير.
// - الموديل: الأساسي ثم الاحتياطي، وبعدهم Groq، وآخر حاجة المجاني اللي من غير مفتاح.
//   المفاتيح من Supabase Vault. البيانات الحساسة مابتروحش لمزوّد بيحتفظ بالبيانات.
// - زرار إيقاف الكل بيوقف الشات كمان.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const KEY_ENV: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  github: "GITHUB_MODELS_TOKEN",
  pollinations: "",
};
const LAST_RESORT = ["groq:big", "groq:small", "pollinations:openai"];

// الصلاحيات اللي المدير التنفيذي يقدر يفتحها أو يقفلها لأي موظف لما رئيس مجلس الإدارة يطلب
const TOOLS: Record<string, string> = {
  view_finance: "لوحة الموقع: الحسابات والفواتير والتحصيل",
  view_bookings: "لوحة الموقع: الحجوزات ومراحل المشاريع",
  view_contacts: "لوحة الموقع: طلبات التواصل والشات",
  view_stats: "لوحة الموقع: الإحصائيات",
  read_all: "يقرا كل حاجة",
  assign_task: "يوزّع مهام",
  request_approval: "يطلب موافقة",
  write_report: "يكتب التقرير",
  osm_search: "يبحث في الخريطة",
  write_leads: "يضيف عملاء محتملين",
  read_leads: "يقرا العملاء المحتملين",
  update_leads: "يعدّل العملاء المحتملين",
  web_check: "يفحص مواقع",
  draft_message: "يكتب مسودة رسالة",
  send_message: "يبعت رسايل للعملاء",
  read_inbox: "يقرا الإيميلات الواردة",
  read_repo: "يقرا كود الموقع",
  read_infra: "يقرا الاشتراكات والبنية",
  open_pull_request: "يفتح Pull Request",
  comment_pull_request: "يعلّق على Pull Request",
};

interface CeoAction {
  type?: string;
  agent_id?: string;
  tool?: string;
  title?: string;
  details?: string;
  text?: string;
}

// مفاتيح الموديلات متخزّنة مشفّرة في Supabase Vault؛ بنقراها بمفتاح service_role
// اللي موجود جوه الـ edge function بس (عمره ما بيوصل للمتصفح).
const keyCache = new Map<string, string | null>();
async function modelKey(name: string): Promise<string | null> {
  if (Deno.env.get(name)) return Deno.env.get(name)!;
  if (keyCache.has(name)) return keyCache.get(name)!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/agent_secret`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ secret_name: name }),
  });
  const value = res.ok ? ((await res.json()) as string | null) : null;
  keyCache.set(name, value);
  return value;
}

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

  // «تمام» و«ماشي» و«شكرًا» مش سؤال: الموظف بيرد زي أي حد طبيعي، من غير ما يعيد كلامه
  const ACK = /^(تمام|ماشي|اوك[يى]?|أوك[يى]?|ok|okay|شكرا|شكرًا|متشكر|حلو|جميل|طيب|خلاص|ماشي يا [^\s]+|تمام يا [^\s]+|تمام كده|ماشي كده|اتفقنا|فهمت|عظيم|ممتاز|برافو)[\s.!،,]*(تمام|ماشي|شكرا|شكرًا|كده)?[\s.!،,]*$/i;
  if (ACK.test(message.trim())) {
    const replies = /شكر|متشكر/.test(message)
      ? ["العفو يا فندم، تحت أمرك.", "ولا يهمك يا فندم.", "تحت أمرك يا فندم في أي وقت."]
      : ["تمام يا فندم، لو احتجت أي حاجة أنا موجود.", "تحت أمرك يا فندم.", "ماشي يا فندم، أي حاجة تانية؟", "حاضر يا فندم."];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    await supabase.from("chats").insert([
      { agent_id: agentId, role: "owner", content: message },
      { agent_id: agentId, role: "agent", content: reply, model_key: null },
    ]);
    return json({ reply, model_key: null, used_fallback: false, done: [] });
  }

  const isCeo = agentId === "ceo";
  const [said, ideas, tasks, history, meeting, report, rules, roster, ownerNotes, latest] = await Promise.all([
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
    // كل اللي رئيس مجلس الإدارة قاله لأي موظف: معلومات مؤكدة يعرفها الفريق كله
    supabase.from("chats").select("agent_id, content, created_at").eq("role", "owner")
      .order("created_at", { ascending: false }).limit(25),
    // آخر أرقام حقيقية حفظها الموظفين (من قاعدة البيانات ومن حسابات الموقع)
    supabase.from("company_settings").select("value").eq("key", "latest_facts").maybeSingle(),
  ]);

  const names = new Map((roster.data ?? []).map((a) => [a.id, a.name]));
  const rulesValue = (rules.data?.value ?? {}) as { pricing?: { min?: number; max?: number }; honesty?: string[] };
  const facts = (latest.data?.value ?? {}) as Record<string, string>;
  const myFacts = isCeo
    ? Object.entries(facts).filter(([k]) => k !== "_at").map(([k, v]) => `- ${names.get(k) ?? k}: ${clip(v, 500)}`).join("\n")
    : [facts[agentId], facts[agent.department], facts._company].filter(Boolean).map((v) => clip(v, 800)).join("\n");
  const memory = [
    "── مرجع ليك (ماتقولش منه غير اللي يخص سؤاله) ──",
    `الأرقام الحقيقية اللي عندك (آخر تحديث ${facts._at ? facts._at.slice(0, 16).replace("T", " ") : "لسه مفيش"} UTC):`,
    myFacts || "لسه مفيش أرقام متسجلة؛ أول تحديث بيحصل مع اجتماع الصبح.",
    "",
    "كلام رئيس مجلس الإدارة لأي حد في الفريق (معلومات مؤكدة منه شخصيًا، الأحدث الأول):",
    ...(ownerNotes.data ?? []).map((c) => `- (قالها لـ${names.get(c.agent_id) ?? c.agent_id}) ${clip(c.content, 300)}`),
    "",
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
    "أصحاب الشركة ورؤساء مجلس الإدارة اتنين: فارس ويوسف. كلامهم أوامر، وبتكلّم واحد منهم دلوقتي.\n" +
    `مهامك: ${(agent.duties ?? []).join("، ")}\n${agent.instructions ?? ""}\n` +
    (agent.status === "paused" ? "ملحوظة: انت موقوف مؤقتًا عن الشغل دلوقتي.\n" : "") +
    `الأسعار المسموحة: من ${rulesValue.pricing?.min ?? "؟"} لـ ${rulesValue.pricing?.max ?? "؟"} جنيه.\n` +
    (rulesValue.honesty ?? []).map((l) => `- ${l}`).join("\n") + "\n\n" +
    "رد بالعامية المصرية الطبيعية زي موظف حقيقي بيكلم صاحب الشركة في التليفون أو على الواتساب:" +
    " مباشر ومحترم، وابدأ بالمهم على طول من غير مقدمات زي «بالتأكيد» أو «سؤال ممتاز» أو «يسعدني»." +
    " كلام عادي من غير عناوين ولا نجوم ولا ترقيم، إلا لو طلب منك تقرير أو قايمة." +
    " خاطبه بـ«يا فندم» أو «حضرتك» من غير مبالغة. لو مش فاهم سؤاله اسأله سؤال قصير." +
    " ممنوع تقول إنك ذكاء اصطناعي أو موديل أو برنامج.\n" +
    "ده حوار مستمر زي أي محادثة بين اتنين: رد على آخر كلام قاله بس، وافتكر اللي اتقال قبل كده واتكلم على أساسه." +
    " ماتجاوبش على حاجات ماسألش عنها، وماتسردش أرقامك أو تقاريرك من نفسك، وماتعيدش جملة أو معلومة قلتها قبل كده في المحادثة." +
    " لو كلامه مجرد رد قصير (زي «تمام» أو «ماشي») رد عليه بكلمة أو اتنين زي أي حد طبيعي.\n" +
    "لما يسألك عن رقم، خده من \"الأرقام الحقيقية\" أو من كلام رئيس مجلس الإدارة، وقول آخر تحديث كان إمتى." +
    " لما يسألك عن قرار أو فكرة، اشرح السبب من السجل بالظبط. لو السبب مش متسجل قول" +
    " \"السبب ده مش متسجل عندي\" وقول رأيك دلوقتي على إنه رأي. ممنوع تألّف أرقام أو أحداث مش في السجل.\n" +
    "أي معلومة رئيس مجلس الإدارة بيقولهالك (أو قالها لأي حد في الفريق) هي معلومة مؤكدة: اعتمد عليها وقوله إنك" +
    " سجّلتها، وإن الفريق كله هيعرفها في الاجتماع الجاي. ماتقولش \"مش متسجلة عندي\" عن حاجة هو لسه قايلها.\n" +
    "اتكلم بس عن الموظفين والأقسام اللي في السجل (الإدارة، المبيعات، العمليات، الموقع والأمان، التطوير)." +
    " مفيش قسم تسويق ومفيش مشاريع أو حملات غير اللي مكتوبة في السجل. لو السجل فاضي قول بصراحة إن الشغل لسه" +
    " مابدأش وأول اجتماع الساعة 8 الصبح، واقترح على إيه نركز من غير ما تألّف إن حاجة حصلت.\n" +
    "شغلنا اليومي الحقيقي (من 8 الصبح لـ 5 العصر): الكشّاف بيدوّر على محلات ومطاعم في بنها مالهاش موقع،" +
    " وبنكتبلهم رسايل بالعامية (الأسعار من 2000 لـ 3000 جنيه)، وفريق الموقع بيفحص stratix.website،" +
    " واجتماع الصبح الساعة 8 واجتماع آخر اليوم والتقرير الساعة 4.\n" +
    "لو اداك توجيه (زي \"ركزوا على كذا بكرة\")، أكّد إنك فهمته وقوله هتعرضه في الاجتماع الجاي" +
    (isCeo ? " وهتوزّع المهام على أساسه." : ".") +
    " لو فيه فلوس برّا الأسعار أو وعد لعميل، قوله إن ده محتاج موافقته من صندوق الموافقات.\n\n" +
    memory;

  const past = (history.data ?? []).reverse().map((c) => ({
    role: c.role === "owner" ? "user" : "assistant",
    content: c.content,
  }));
  const ceoProtocol = !isCeo ? "" :
    "\n\nانت المدير التنفيذي، ورئيس مجلس الإدارة بيكلمك. لما يطلب منك تعمل حاجة، نفّذها فعلًا عن طريق \"actions\"." +
    " رد دايمًا بـ JSON بالشكل ده بس: {\"reply\": ردك بالعامية, \"actions\": [...]}. الـ actions المتاحة:\n" +
    "- {\"type\":\"grant\",\"agent_id\":كود الموظف,\"tool\":كود الصلاحية}: تفتح صلاحية لموظف.\n" +
    "- {\"type\":\"revoke\",\"agent_id\":...,\"tool\":...}: تقفل صلاحية.\n" +
    "- {\"type\":\"task\",\"agent_id\":...,\"title\":المهمة,\"details\":تفاصيل وميعاد}: مهمة لموظف (زي تقرير يبعته بكرة).\n" +
    "- {\"type\":\"note\",\"text\":...}: ملاحظة يسجّلها للفريق كله.\n" +
    `أكواد الموظفين: ${(roster.data ?? []).map((a) => `${a.id}=${a.name}`).join("، ")}\n` +
    `أكواد الصلاحيات: ${Object.entries(TOOLS).map(([k, v]) => `${k} (${v})`).join("، ")}\n` +
    "لو مفيش حاجة تتنفّذ خلّي actions فاضية. ماتقولش إنك نفّذت حاجة من غير ما تحطها في actions.";
  const messages = [{ role: "system", content: system + ceoProtocol }, ...past, { role: "user", content: message }];

  const keys = [...new Set([agent.primary_model, agent.fallback_model, ...LAST_RESORT])];
  const { data: catalog } = await supabase.from("model_catalog").select("*").in("key", keys);
  const chain = keys
    .map((key) => (catalog as ModelRow[] | null)?.find((m) => m.key === key))
    .filter((m): m is ModelRow => Boolean(m));

  const reasons: string[] = [];
  // ردود الموظف اللي فاتت: لو الرد الجديد شبهها بيتكتب من جديد (مايعيدش نفس الكلام)
  // history اتقلبت فوق (الأقدم الأول)، فآخر 6 ردود هما آخر العناصر
  const lastReplies = (history.data ?? []).filter((c) => c.role === "agent").slice(-6).map((c) => c.content);
  const words = (t: string) => new Set(t.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
  const similar = (a: string, b: string) => {
    const A = words(a), B = words(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    return inter / Math.min(A.size, B.size);
  };
  let retried = false;
  for (let index = 0; index < chain.length; index++) {
    const model = chain[index];
    const keyEnv = KEY_ENV[model.provider];
    const apiKey = keyEnv ? await modelKey(keyEnv) : "";
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
        body: JSON.stringify({
          model: model.model_id, messages, temperature: 0.4,
          ...(isCeo && model.provider !== "pollinations" ? { response_format: { type: "json_object" } } : {}),
        }),
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

    let visible = reply;
    if (isCeo) { try { visible = String(JSON.parse(reply).reply ?? reply); } catch { /* نص عادي */ } }
    const repeated = lastReplies.some((r) => similar(visible, r) > 0.6);
    if (repeated && retried) {
      reply = isCeo
        ? JSON.stringify({ reply: "زي ما قلت لحضرتك يا فندم. تحب أفصّل في حاجة معينة؟", actions: [] })
        : "زي ما قلت لحضرتك يا فندم. تحب أفصّل في حاجة معينة؟";
    } else if (repeated) {
      retried = true;
      messages.push({ role: "assistant", content: reply }, { role: "user", content:
        "(ملحوظة من النظام مش من رئيس مجلس الإدارة: ردك ده تكرار لكلام قلته قبل كده. رد تاني على آخر رسالة بس بكلام جديد ومختصر.)" });
      index--;
      continue;
    }

    // المدير التنفيذي: بينفّذ اللي رئيس مجلس الإدارة طلبه (صلاحيات، مهام، ملاحظات)
    const done: string[] = [];
    if (isCeo) {
      let parsed: { reply?: string; actions?: CeoAction[] } = {};
      try { parsed = JSON.parse(reply); } catch { /* رد نصي عادي */ }
      if (typeof parsed.reply === "string") {
        reply = parsed.reply.trim();
        const agentsById = new Map((roster.data ?? []).map((a) => [a.id, a]));
        for (const action of Array.isArray(parsed.actions) ? parsed.actions.slice(0, 10) : []) {
          const target = action.agent_id ? agentsById.get(action.agent_id) : undefined;
          if ((action.type === "grant" || action.type === "revoke") && target && action.tool && TOOLS[action.tool]) {
            const { data: row } = await supabase.from("agents").select("tools").eq("id", target.id).maybeSingle();
            const current: string[] = row?.tools ?? [];
            const next = action.type === "grant"
              ? [...new Set([...current, action.tool])]
              : current.filter((t) => t !== action.tool);
            const { error } = await supabase.from("agents").update({ tools: next }).eq("id", target.id);
            if (!error) done.push(`${action.type === "grant" ? "فتحت" : "قفلت"} لـ${target.name} صلاحية «${TOOLS[action.tool]}»`);
          } else if (action.type === "task" && target && action.title) {
            const { error } = await supabase.from("tasks").insert({
              agent_id: target.id, title: String(action.title).slice(0, 300),
              details: `بطلب من رئيس مجلس الإدارة. ${String(action.details ?? "")}`.slice(0, 2000), status: "todo",
            });
            if (!error) done.push(`سجّلت مهمة لـ${target.name}: ${String(action.title).slice(0, 120)}`);
          } else if (action.type === "note" && action.text) {
            done.push(`سجّلت: ${String(action.text).slice(0, 200)}`);
          }
        }
        if (done.length) {
          await supabase.from("messages").insert(done.map((d) => ({
            agent_id: "ceo", kind: "decision", content: `بأمر رئيس مجلس الإدارة: ${d}`,
          })));
          reply += "\n\n" + done.map((d) => `✅ ${d}`).join("\n");
        }
      }
    }

    await supabase.from("chats").insert([
      { agent_id: agentId, role: "owner", content: message },
      { agent_id: agentId, role: "agent", content: reply, model_key: model.key },
    ]);
    return json({ reply, model_key: model.key, used_fallback: index > 0, done });
  }

  const hint = agent.sensitive
    ? " (الموظف ده شغال على بيانات عملاء وفلوس، فمابيستخدمش الموديل المجاني اللي من غير مفتاح.)"
    : "";
  return fail(`${agent.name} مش قادر يرد دلوقتي — ${reasons.join("؛ ") || "مفيش موديل متاح"}${hint}`, 503);
});
