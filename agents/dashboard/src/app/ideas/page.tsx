"use client";

import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Agent } from "@/lib/types";
import { useLive } from "@/lib/useLive";

interface Proposal {
  id: number;
  meeting_id: number;
  agent_id: string;
  idea: string;
  status: "pending" | "approved" | "rejected";
  ceo_reason: string | null;
  created_at: string;
}

interface Task {
  id: number;
  agent_id: string;
  title: string;
  details: string | null;
  status: "todo" | "doing" | "done" | "blocked";
  created_at: string;
}

const PROPOSAL_LABEL = { pending: "مستنية المدير", approved: "المدير وافق", rejected: "المدير رفض" };
const TASK_LABEL = { todo: "لسه", doing: "شغّال عليها", done: "خلصت", blocked: "واقفة" };

// الأفكار اللي الموظفين اقترحوها في الاجتماعات، وقرار المدير التنفيذي في كل واحدة، والمهام اللي اتوزعت.
export default function IdeasPage() {
  const agents = useLive<Agent>("agents", () => supabase().from("agents").select("id, name, title"));
  const proposals = useLive<Proposal>("proposals", () =>
    supabase().from("proposals").select("*").order("created_at", { ascending: false }).limit(200),
  );
  const tasks = useLive<Task>("tasks", () =>
    supabase().from("tasks").select("*").order("created_at", { ascending: false }).limit(200),
  );
  const names = useMemo(() => new Map(agents.rows.map(a => [a.id, a.name])), [agents.rows]);

  async function setTask(id: number, status: Task["status"]) {
    await supabase().from("tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  }

  return (
    <>
      <h1>الأفكار والقرارات</h1>
      <div className="grid">
        <section>
          <h2>أفكار الموظفين</h2>
          {proposals.rows.length === 0 && <p className="panel muted">لسه مفيش أفكار.</p>}
          {proposals.rows.map(p => (
            <div key={p.id} className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{names.get(p.agent_id) ?? p.agent_id}</strong>
                <span className={`chip ${p.status === "approved" ? "ok" : p.status === "rejected" ? "danger" : ""}`}>
                  {PROPOSAL_LABEL[p.status]}
                </span>
              </div>
              <p style={{ margin: "6px 0" }}>💡 {p.idea}</p>
              {p.ceo_reason && <p className="muted">المدير: {p.ceo_reason}</p>}
              <div className="muted">{new Date(p.created_at).toLocaleString("ar-EG")}</div>
            </div>
          ))}
        </section>
        <section>
          <h2>المهام اللي المدير وزّعها</h2>
          {tasks.rows.length === 0 && <p className="panel muted">لسه مفيش مهام.</p>}
          {tasks.rows.map(t => (
            <div key={t.id} className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{names.get(t.agent_id) ?? t.agent_id}</strong>
                <select value={t.status} onChange={e => setTask(t.id, e.target.value as Task["status"])} style={{ width: "auto" }}>
                  {Object.entries(TASK_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <p style={{ margin: "6px 0" }}>{t.title}</p>
              {t.details && <p className="muted">{t.details}</p>}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
