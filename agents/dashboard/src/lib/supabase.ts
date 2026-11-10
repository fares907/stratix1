"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// العنوان والمفتاح العام (publishable) معمولين عشان يبقوا في المتصفح؛
// الحماية الحقيقية هي RLS: اللي مش في جدول owners مايشوفش ولا يعدّل أي حاجة.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://frpqnfygixxolvpseqox.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_JRoSgvCLIdMKTIldXvfJQg_t467sHTu";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
