"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHead } from "@/components/ui";
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
  result: string | null;
  completed_at: string | null;
  status: "todo" | "doing" | "done" | "blocked";
  due_date: string | null;
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
      <PageHead eyebrow="من الاجتماعات" title="الأفكار والقرارات" subtitle="كل فكرة اقترحها موظف، وقرار المدير التنفيذي فيها وسببه، والمهام اللي اتوزعت." />
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
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">{new Date(p.created_at).toLocaleString("ar-EG")}</span>
                <span className="row">
                  <Link
                    className="btn"
                    href={`/chat?agent=ceo&q=${encodeURIComponent(
                      `ليه ${p.status === "approved" ? "وافقت على" : p.status === "rejected" ? "رفضت" : "لسه ماقررتش في"} فكرة ${names.get(p.agent_id) ?? p.agent_id} (#${p.id}): «${p.idea.slice(0, 120)}»؟`,
                    )}`}
                  >
                    اسأل المدير
                  </Link>
                  <Link
                    className="btn"
                    href={`/chat?agent=${p.agent_id}&q=${encodeURIComponent(`احكيلي أكتر عن فكرتك: «${p.idea.slice(0, 120)}»`)}`}
                  >
                    اسأل صاحب الفكرة
                  </Link>
                </span>
              </div>
            </div>
          ))}
        </section>
        <section>
          <h2>المهام (ومن ضمنها اللي طلبتها من نادر)</h2>
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
              {t.due_date && t.status !== "done" && (
                <p className="muted" style={{ margin: "0 0 6px" }}>
                  ميعادها: {new Date(`${t.due_date}T12:00:00`).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              )}
              {t.details && <p className="muted">{t.details}</p>}
              {t.result && (
                <details open={Boolean(t.completed_at && Date.now() - new Date(t.completed_at).getTime() < 86_400_000)}>
                  <summary>اللي سلّمه{t.completed_at ? ` — ${new Date(t.completed_at).toLocaleString("ar-EG")}` : ""}</summary>
                  <div style={{ whiteSpace: "pre-wrap" }}>{t.result}</div>
                </details>
              )}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
