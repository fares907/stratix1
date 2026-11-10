import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

// أزرار الموافقة في تليجرام بتوصل هنا.
// الحماية: Telegram بيبعت TELEGRAM_WEBHOOK_SECRET في header (بنحدده وقت setWebhook)،
// وبنقبل بس الضغطات اللي جاية من TELEGRAM_CHAT_ID بتاعك.
// SUPABASE_SERVICE_ROLE_KEY هنا server-only (مش NEXT_PUBLIC)، وعمره ما بيوصل للمتصفح.

export const dynamic = "force-dynamic";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function telegram(method: string, body: unknown) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !same(given, secret)) return new Response("forbidden", { status: 403 });

  const update = await request.json().catch(() => null);
  const callback = update?.callback_query;
  const chatId = String(callback?.message?.chat?.id ?? update?.message?.chat?.id ?? "");
  if (!chatId || chatId !== process.env.TELEGRAM_CHAT_ID) return new Response("ok");

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // رسالة نصية: /stop يوقف الكل، /start يرجّعهم
  const text: string = update?.message?.text ?? "";
  if (text === "/stop" || text === "/start") {
    const halted = text === "/stop";
    await db
      .from("system_state")
      .update({ halted, halted_reason: halted ? "من تليجرام" : null, updated_at: new Date().toISOString() })
      .eq("id", 1);
    await telegram("sendMessage", { chat_id: chatId, text: halted ? "■ كل الموظفين وقفوا." : "▶ الشركة رجعت تشتغل." });
    return new Response("ok");
  }

  const match = /^(approve|reject):(\d+)$/.exec(callback?.data ?? "");
  if (!match) return new Response("ok");
  const status = match[1] === "approve" ? "approved" : "rejected";
  const { data } = await db
    .from("approvals")
    .update({ status, decided_at: new Date().toISOString(), decision_note: "من تليجرام" })
    .eq("id", Number(match[2]))
    .eq("status", "pending")
    .select("id");

  await telegram("answerCallbackQuery", {
    callback_query_id: callback.id,
    text: data?.length ? (status === "approved" ? "✅ اتوافق — هيتنفّذ في التشغيل الجاي" : "❌ اترفض") : "اتقررت قبل كده",
  });
  return new Response("ok");
}
