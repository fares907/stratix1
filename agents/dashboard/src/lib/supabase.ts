"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// عميل واحد للمتصفح كله. الصلاحيات بتتحدد في قاعدة البيانات (RLS):
// اللي مش في جدول owners مايشوفش ولا يعدّل أي حاجة.
export function supabase(): SupabaseClient {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
