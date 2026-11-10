"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Agent } from "@/lib/types";
import { useLive } from "@/lib/useLive";

interface Chat {
  id: number;
  agent_id: string;
  role: "owner" | "agent";
  content: string;
  model_key: string | null;
  created_at: string;
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatRoom />
    </Suspense>
  );
}

// كلّم أي موظف: اسأله عن قراراته وأفكاره وشغله، واديله توجيهات بياخدها في الاجتماع الجاي.
function ChatRoom() {
  const params = useSearchParams();
  const [agentId, setAgentId] = useState(params.get("agent") ?? "ceo");
  const [draft, setDraft] = useState(params.get("q") ?? "");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const agents = useLive<Agent>("agents", () =>
    supabase().from("agents").select("*").neq("status", "fired").order("department"),
  );
  const chats = useLive<Chat>("chats", () =>
    supabase().from("chats").select("*").eq("agent_id", agentId).order("created_at").limit(200),
  );
  const { refresh } = chats;
  useEffect(() => {
    refresh();
  }, [agentId, refresh]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats.rows.length, pending]);

  const agent = agents.rows.find(a => a.id === agentId);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setPending(text);
    setDraft("");
    // الشات بيروح لـ edge function في Supabase بجلسة رئيس مجلس الإدارة نفسها
    const { data, error: fnError } = await supabase().functions.invoke("agent-chat", {
      body: { agent_id: agentId, message: text },
    });
    setSending(false);
    setPending(null);
    if (fnError || !data?.reply) {
      let message = "حصلت مشكلة";
      try {
        const body = await (fnError as { context?: Response } | null)?.context?.json();
        message = body?.error ?? message;
      } catch {
        /* الرد مش JSON */
      }
      setError(message);
      setDraft(text);
      return;
    }
    refresh();
  }

  return (
    <>
      <h1>كلّم الموظفين</h1>
      <div className="row" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
        <aside className="panel" style={{ flex: "1 1 200px", maxWidth: 280 }}>
          {agents.rows.map(a => (
            <button
              key={a.id}
              onClick={() => setAgentId(a.id)}
              className={a.id === agentId ? "primary" : ""}
              style={{ display: "block", width: "100%", textAlign: "start", marginBottom: 6 }}
            >
              {a.name}
              <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>{a.title}</div>
            </button>
          ))}
        </aside>

        <section className="panel" style={{ flex: "3 1 320px", display: "flex", flexDirection: "column", minHeight: 480 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <strong>{agent ? `${agent.name} — ${agent.title}` : agentId}</strong>
            {agent?.status === "paused" && <span className="chip warn">موقوف مؤقتًا</span>}
          </div>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: "60vh" }}>
            {chats.rows.length === 0 && !pending && (
              <p className="muted">
                اسأله عن أي حاجة: «ليه وافقت على فكرة نور؟»، «إيه أكبر مشكلة عندك؟». وأي توجيه تقوله بياخده في
                اعتباره في الاجتماع الجاي.
              </p>
            )}
            {chats.rows.map(c => (
              <Bubble key={c.id} mine={c.role === "owner"} text={c.content} meta={c.role === "agent" ? c.model_key : null} />
            ))}
            {pending && (
              <>
                <Bubble mine text={pending} meta={null} />
                <p className="muted">{agent?.name ?? "الموظف"} بيكتب…</p>
              </>
            )}
            <div ref={bottom} />
          </div>
          {error && <p className="error">{error}</p>}
          <form onSubmit={send} className="row" style={{ marginTop: 8 }}>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="اكتب رسالتك…"
              style={{ flex: 1, minHeight: 60 }}
            />
            <button className="primary" type="submit" disabled={sending || !draft.trim()}>
              ابعت
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

function Bubble({ mine, text, meta }: { mine: boolean; text: string; meta: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-start" : "flex-end", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "80%",
          padding: "8px 12px",
          borderRadius: 12,
          background: mine ? "var(--accent)" : "var(--chip)",
          color: mine ? "#fff" : "var(--text)",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
        {meta && <div style={{ fontSize: "0.7rem", opacity: 0.7, marginTop: 4 }} dir="ltr">{meta}</div>}
      </div>
    </div>
  );
}
