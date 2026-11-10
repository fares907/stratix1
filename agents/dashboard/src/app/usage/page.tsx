"use client";

import { PageHead, Stat } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { ModelInfo } from "@/lib/types";
import { useLive } from "@/lib/useLive";

interface Call {
  model_key: string;
  agent_id: string;
  status: string;
  is_fallback: boolean;
  prompt_tokens: number;
  completion_tokens: number;
}

const startOfUtcDay = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
};

// الاستهلاك النهارده مقارنة بالحد المجاني لكل موديل (الحدود بتتصفّر الساعة 2 بليل بتوقيت مصر = منتصف الليل UTC).
export default function UsagePage() {
  const models = useLive<ModelInfo>("model_catalog", () => supabase().from("model_catalog").select("*").order("key"));
  const calls = useLive<Call>(
    "llm_calls",
    () =>
      supabase()
        .from("llm_calls")
        .select("model_key, agent_id, status, is_fallback, prompt_tokens, completion_tokens")
        .gte("created_at", startOfUtcDay())
        .limit(20000),
    30_000,
  );

  const counted = calls.rows.filter(c => c.status !== "network_error");
  const fallbacks = calls.rows.filter(c => c.is_fallback && c.status === "ok").length;
  const limited = calls.rows.filter(c => c.status === "rate_limited").length;
  const tokens = calls.rows.reduce((sum, c) => sum + c.prompt_tokens + c.completion_tokens, 0);

  return (
    <>
      <PageHead eyebrow="النهارده" title="استهلاك الموديلات" subtitle="الموظفين استخدموا الذكاء الاصطناعي كام مرة، مقارنة بالحد المجاني اليومي." />
      <div className="stats">
        <Stat label="طلبات" value={counted.length} />
        <Stat label="اتحوّلت للاحتياطي" value={fallbacks} />
        <Stat label="المزوّد رفض (429)" value={limited} />
        <Stat label="توكنز" value={tokens.toLocaleString("ar-EG")} />
      </div>
      {calls.error && <p className="error">{calls.error}</p>}
      <div className="panel">
        {models.rows.map(m => {
          const used = counted.filter(c => c.model_key === m.key).length;
          const pct = Math.min(100, Math.round((used / m.rpd) * 100));
          return (
            <div key={m.key} style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span dir="ltr">{m.key}</span>
                <span className="muted">
                  {used} / {m.rpd} في اليوم · {m.rpm} في الدقيقة
                  {m.trains_on_free_data && " · بيستخدم البيانات المجانية"}
                </span>
              </div>
              <div className="bar">
                <span className={pct >= 90 ? "full" : ""} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <p className="muted">الحدود دي تقديرية ومكتوبة في providers.yaml؛ المزوّدين بيغيّروها. لو مزوّد رفض بدري، الحد الحقيقي أقل.</p>
      </div>
    </>
  );
}
