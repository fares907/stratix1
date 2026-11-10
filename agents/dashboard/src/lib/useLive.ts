"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "./supabase";

/**
 * بيجيب البيانات ويعيد تحميلها لوحده كل ما الجدول يتغيّر (Supabase Realtime).
 * لو الجدول مش في الـ realtime publication بيحمّل كل `pollMs` بدل كده.
 */
export function useLive<T>(
  table: string,
  load: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pollMs = 0,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const channelId = useId();
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    const { data, error } = await loadRef.current();
    setError(error?.message ?? null);
    if (data) setRows(data);
    setLoading(false);
  }, [table]);

  useEffect(() => {
    refresh();
    const channel = supabase()
      .channel(`live-${table}-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => refresh())
      .subscribe();
    const timer = pollMs ? setInterval(refresh, pollMs) : undefined;
    return () => {
      supabase().removeChannel(channel);
      if (timer) clearInterval(timer);
    };
  }, [table, refresh, pollMs, channelId]);

  return { rows, error, loading, refresh };
}
