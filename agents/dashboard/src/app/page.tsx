"use client";

import { useEffect, useMemo, useState } from "react";
import { HaltedBanner } from "@/components/KillSwitch";
import { supabase } from "@/lib/supabase";
import type { Agent, Message } from "@/lib/types";
import { useLive } from "@/lib/useLive";

const KIND_LABEL: Record<Message["kind"], string> = {
  speech: "رأي",
  objection: "اعتراض",
  decision: "قرار",
  activity: "شغل",
  error: "مشكلة",
};

const CONFIDENCE_LABEL = { high: "متأكد", medium: "متأكد لحد ما", low: "مش متأكد" };

interface Meeting {
  id: number;
  kind: string;
  status: string;
  summary: string | null;
  started_at: string;
}

const time = (iso: string) =>
  new Date(iso).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });

// غرفة الاجتماعات: كل كلمة قالها أي موظف، لايف، ومين رد على مين.
export default function MeetingRoom() {
  const [agentFilter, setAgentFilter] = useState("");
  const [meetingFilter, setMeetingFilter] = useState("");

  const agents = useLive<Agent>("agents", () => supabase().from("agents").select("*").order("department"));
  const meetings = useLive<Meeting>("meetings", () =>
    supabase().from("meetings").select("*").order("started_at", { ascending: false }).limit(30),
  );
  const messages = useLive<Message>("messages", () => {
    let query = supabase().from("messages").select("*").order("created_at", { ascending: false }).limit(300);
    if (agentFilter) query = query.eq("agent_id", agentFilter);
    if (meetingFilter) query = query.eq("meeting_id", Number(meetingFilter));
    return query;
  });

  const byId = useMemo(() => new Map(agents.rows.map(a => [a.id, a])), [agents.rows]);
  const messageById = useMemo(() => new Map(messages.rows.map(m => [m.id, m])), [messages.rows]);
  const who = (id: string | null) => (id ? byId.get(id)?.name ?? id : "النظام");

  const { refresh: refreshMessages } = messages;
  useEffect(() => {
    refreshMessages();
  }, [agentFilter, meetingFilter, refreshMessages]);

  return (
    <>
      <HaltedBanner />
      <h1>غرفة الاجتماعات</h1>

      <div className="panel row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="agent">الموظف</label>
          <select id="agent" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
            <option value="">الكل</option>
            {agents.rows.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.title}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="meeting">الاجتماع</label>
          <select id="meeting" value={meetingFilter} onChange={e => setMeetingFilter(e.target.value)}>
            <option value="">كل النشاط</option>
            {meetings.rows.map(m => (
              <option key={m.id} value={m.id}>
                {time(m.started_at)} — {m.status === "running" ? "شغّال دلوقتي" : "خلص"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {meetingFilter && meetings.rows.find(m => String(m.id) === meetingFilter)?.summary && (
        <div className="panel">
          <h2>ملخص الاجتماع</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {meetings.rows.find(m => String(m.id) === meetingFilter)?.summary}
          </p>
        </div>
      )}

      <div className="panel">
        {messages.error && <p className="error">{messages.error}</p>}
        {!messages.loading && messages.rows.length === 0 && <p className="muted">لسه مفيش كلام.</p>}
        {messages.rows.map(m => {
          const parent = m.reply_to ? messageById.get(m.reply_to) : undefined;
          return (
            <article key={m.id} className={`msg ${m.kind}`}>
              <div className="row">
                <strong>{who(m.agent_id)}</strong>
                <span className="chip">{KIND_LABEL[m.kind]}</span>
                {m.confidence && (
                  <span className={`chip ${m.confidence === "low" ? "warn" : ""}`}>
                    {CONFIDENCE_LABEL[m.confidence]}
                  </span>
                )}
                {m.used_fallback && <span className="chip warn">موديل احتياطي</span>}
                <span className="muted">{time(m.created_at)}</span>
              </div>
              {m.reply_to && (
                <div className="reply">
                  ↩ رد على {parent ? `${who(parent.agent_id)}: «${parent.content.slice(0, 80)}»` : `رسالة #${m.reply_to}`}
                </div>
              )}
              <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{m.content}</p>
              {(m.reasoning || (m.unknowns && m.unknowns.length > 0) || m.model_key) && (
                <details>
                  <summary>بيفكر في إيه</summary>
                  {m.reasoning && <p style={{ whiteSpace: "pre-wrap" }}>{m.reasoning}</p>}
                  {m.unknowns && m.unknowns.length > 0 && (
                    <p>
                      مش متأكد من: {m.unknowns.join("، ")}
                    </p>
                  )}
                  {m.model_key && <p className="muted">الموديل: {m.model_key}</p>}
                </details>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
