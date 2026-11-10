"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLive } from "@/lib/useLive";

interface SystemState {
  halted: boolean;
  halted_reason: string | null;
}

// زرار إيقاف الكل: بيكتب halted = true، وكل agent بيشيّك عليه قبل أي طلب للموديل
// وقبل أي أداة، فبيقفوا في أول خطوة جاية.
export function KillSwitch() {
  const { rows, error } = useLive<SystemState>("system_state", () =>
    supabase().from("system_state").select("halted, halted_reason").eq("id", 1),
  );
  const [busy, setBusy] = useState(false);
  const halted = rows[0]?.halted ?? false;

  async function toggle() {
    const next = !halted;
    const question = next
      ? "إيقاف كل الموظفين دلوقتي؟ مفيش أي agent هيشتغل لحد ما ترجّعهم."
      : "ترجّع الشركة تشتغل تاني؟";
    if (!window.confirm(question)) return;
    const reason = next ? window.prompt("السبب (اختياري):") ?? "" : null;
    setBusy(true);
    const { error } = await supabase()
      .from("system_state")
      .update({ halted: next, halted_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setBusy(false);
    if (error) window.alert(`ماعرفتش أنفّذ: ${error.message}`);
  }

  if (error) return <span className="chip danger">حالة الشركة مش معروفة</span>;

  return halted ? (
    <button className="primary" onClick={toggle} disabled={busy} title={rows[0]?.halted_reason ?? ""}>
      ▶ تشغيل الكل
    </button>
  ) : (
    <button className="danger" onClick={toggle} disabled={busy}>
      ■ إيقاف الكل
    </button>
  );
}

export function HaltedBanner() {
  const { rows } = useLive<SystemState>("system_state", () =>
    supabase().from("system_state").select("halted, halted_reason").eq("id", 1),
  );
  if (!rows[0]?.halted) return null;
  return (
    <div className="halted-banner">
      الشركة واقفة دلوقتي{rows[0].halted_reason ? `: ${rows[0].halted_reason}` : ""}
    </div>
  );
}
