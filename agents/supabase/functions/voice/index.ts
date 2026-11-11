// الصوت في اللوحة: كلام رئيس مجلس الإدارة يتحوّل لكتابة، وردود الفريق تتحوّل لصوت.
//
// POST multipart (audio=ملف)        → {"text": "..."}  (Groq Whisper: بيفهم العامية المصرية كويس)
// POST json {action:"tts", text, voice} → ملف صوت wav  (Groq Orpheus عربي — صوت طبيعي)
//      لو صوت Groq مش متاح بيرجّع 424 {fallback:true} واللوحة بتستخدم صوت الجهاز.
//
// بجلسة رئيس مجلس الإدارة بس (verify_jwt + فحص RLS)، ومفتاح Groq من Supabase Vault.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const STT_MODEL = "whisper-large-v3";
const TTS_MODEL = "canopylabs/orpheus-arabic-saudi";
const VOICES = new Set(["fahad", "sultan", "noura", "lulwa", "abdullah", "aisha"]);
// كلمات الشركة عشان التحويل يكتبها صح
const VOCAB = "اجتماع شركة STRATIX مع نادر وطارق ومنى وزياد وليلى وعمر ونور ورنا ومصطفى وكريم وهاني ويوسف ورامي. بنها، مواقع، عملاء، حجوزات.";
const MAX_AUDIO = 20 * 1024 * 1024;

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
  if (!groqKey) throw new Error("no key");
  return groqKey;
}

// النطق: الأرقام والرموز بتتقري غلط، فبننضّف النص قبل ما يتحوّل صوت
function speakable(text: string) {
  return text
    .replace(/[*_#`>|]/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // رئيس مجلس الإدارة بس (نفس قاعدة RLS بتاعة باقي اللوحة)
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: state } = await db.from("system_state").select("id").eq("id", 1).maybeSingle();
  if (!state) return json({ error: "مش مسموحلك" }, 403);

  let k: string;
  try {
    k = await key();
  } catch {
    return json({ error: "مفيش مفتاح Groq" }, 500);
  }

  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) return json({ error: "مفيش تسجيل" }, 400);
    if (audio.size > MAX_AUDIO) return json({ error: "التسجيل طويل قوي" }, 413);
    const out = new FormData();
    out.append("file", audio, audio.name || "speech.webm");
    out.append("model", STT_MODEL);
    out.append("language", "ar");
    out.append("prompt", VOCAB);
    out.append("response_format", "json");
    out.append("temperature", "0");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${k}` }, body: out, signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return json({ error: `مقدرتش أسمع التسجيل (${res.status})` }, 502);
    const data = await res.json();
    return json({ text: String(data.text ?? "").trim() });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action !== "tts") return json({ error: "action لازم يكون tts" }, 400);
  const text = speakable(String(body.text ?? ""));
  if (!text) return json({ error: "مفيش كلام" }, 400);
  const voice = VOICES.has(body.voice) ? body.voice : "fahad";
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: TTS_MODEL, input: text, voice, response_format: "wav" }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const code = /model_terms_required/.test(detail) ? "terms" : String(res.status);
    return json({ error: "صوت Groq مش متاح", code, fallback: true }, 424);
  }
  return new Response(res.body, { headers: { ...cors, "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
});
