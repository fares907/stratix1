"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Agent, Approval } from "@/lib/types";
import { useLive } from "@/lib/useLive";

const STATUS_LABEL: Record<Approval["status"], string> = {
  pending: "مستنية قرارك",
  approved: "اتوافق عليها",
  rejected: "اترفضت",
  executed: "اتنفذت",
  failed: "فشلت",
};

// صندوق الموافقات: اللي توافق عليه بس هو اللي بيتنفّذ.
// الـ worker بتاع الـ agents بيدوّر على status = approved وينفّذ الـ payload زي ما هو.
export default function ApprovalsPage() {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const agents = useLive<Agent>("agents", () => supabase().from("agents").select("id, name"));
  const approvals = useLive<Approval>("approvals", () =>
    supabase().from("approvals").select("*").order("created_at", { ascending: false }).limit(200),
  );
  const name = (id: string) => agents.rows.find(a => a.id === id)?.name ?? id;
  const rows = approvals.rows.filter(a => (tab === "pending" ? a.status === "pending" : a.status !== "pending"));

  return (
    <>
      <h1>الموافقات</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={tab === "pending" ? "primary" : ""} onClick={() => setTab("pending")}>
          مستنية ({approvals.rows.filter(a => a.status === "pending").length})
        </button>
        <button className={tab === "history" ? "primary" : ""} onClick={() => setTab("history")}>
          اللي اتقررت
        </button>
      </div>
      {approvals.error && <p className="error">{approvals.error}</p>}
      {rows.length === 0 && <p className="muted panel">مفيش حاجة هنا.</p>}
      {rows.map(a => (
        <ApprovalCard key={a.id} approval={a} agentName={name(a.agent_id)} />
      ))}
    </>
  );
}

function ApprovalCard({ approval, agentName }: { approval: Approval; agentName: string }) {
  const [payload, setPayload] = useState(JSON.stringify(approval.payload, null, 2));
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(status: "approved" | "rejected") {
    let parsed: unknown = approval.payload;
    if (editing) {
      try {
        parsed = JSON.parse(payload);
      } catch {
        setError("التعديل مش JSON سليم");
        return;
      }
    }
    setBusy(true);
    const { error } = await supabase()
      .from("approvals")
      .update({
        status,
        payload: parsed,
        decision_note: note || null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", approval.id)
      .eq("status", "pending"); // مايتقررش مرتين
    setBusy(false);
    if (error) setError(error.message);
  }

  const body = typeof approval.payload.body === "string" ? approval.payload.body : null;

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{approval.summary}</strong>
        <span className="chip">{STATUS_LABEL[approval.status]}</span>
      </div>
      <div className="muted">
        من {agentName} · {approval.kind} · {new Date(approval.created_at).toLocaleString("ar-EG")}
      </div>
      {approval.reasons.length > 0 && (
        <p>
          ليه محتاجة موافقة:{" "}
          {approval.reasons.map(r => (
            <span key={r} className="chip warn" style={{ marginInlineEnd: 4 }}>
              {r}
            </span>
          ))}
        </p>
      )}
      {editing ? (
        <>
          <label>عدّل قبل الموافقة</label>
          <textarea dir="ltr" style={{ minHeight: 180, fontFamily: "monospace" }} value={payload} onChange={e => setPayload(e.target.value)} />
        </>
      ) : body ? (
        <p style={{ whiteSpace: "pre-wrap", background: "var(--bg)", padding: 12, borderRadius: 8 }}>{body}</p>
      ) : (
        <pre dir="ltr" style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
          {JSON.stringify(approval.payload, null, 2)}
        </pre>
      )}
      {approval.decision_note && <p className="muted">ملاحظتك: {approval.decision_note}</p>}
      {approval.status === "pending" && (
        <>
          <label>ملاحظة (اختياري، الـ agents بيقروها)</label>
          <input value={note} onChange={e => setNote(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" disabled={busy} onClick={() => decide("approved")}>
              {editing ? "موافقة بالتعديل" : "موافقة"}
            </button>
            <button className="danger" disabled={busy} onClick={() => decide("rejected")}>
              رفض
            </button>
            <button disabled={busy} onClick={() => setEditing(e => !e)}>
              {editing ? "إلغاء التعديل" : "تعديل"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
