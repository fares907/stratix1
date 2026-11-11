"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HaltedBanner } from "@/components/KillSwitch";
import { LiveMeeting } from "@/components/LiveMeeting";
import { Avatar, Empty, PageHead, Stat } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { Agent, Message } from "@/lib/types";
import { useLive } from "@/lib/useLive";

const KIND: Record<Message["kind"], { label: string; cls: string }> = {
  speech: { label: "رأي", cls: "" },
  objection: { label: "اعتراض", cls: "warn" },
  decision: { label: "قرار", cls: "signal" },
  activity: { label: "شغل", cls: "ok" },
  error: { label: "مشكلة", cls: "danger" },
};

const CONFIDENCE = {
  high: { label: "متأكد", cls: "ok" },
  medium: { label: "متأكد لحد ما", cls: "" },
  low: { label: "مش متأكد", cls: "warn" },
};

interface Meeting {
  id: number;
  kind: string;
  status: string;
  summary: string | null;
  started_at: string;
  topic: string | null;
  ends_at: string | null;
}

const MEETING_KIND: Record<string, string> = { morning: "اجتماع الصبح", evening: "اجتماع آخر اليوم", daily: "اجتماع", live: "اجتماع لايف مع رئيس مجلس الإدارة" };

const time = (iso: string) =>
  new Date(iso).toLocaleString("ar-EG", { weekday: "short", hour: "numeric", minute: "2-digit" });

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

// غرفة الاجتماعات: كل كلمة قالها أي موظف، لايف، ومين رد على مين.
export default function MeetingRoom() {
  const [agentFilter, setAgentFilter] = useState("");
  const [meetingFilter, setMeetingFilter] = useState("");

  const agents = useLive<Agent>("agents", () => supabase().from("agents").select("*").order("department"));
  const meetings = useLive<Meeting>("meetings", () =>
    supabase().from("meetings").select("*").order("started_at", { ascending: false }).limit(30),
  );
  const pending = useLive<{ id: number }>("approvals", () =>
    supabase().from("approvals").select("id").eq("status", "pending"),
  );
  const messages = useLive<Message>("messages", () => {
    let query = supabase().from("messages").select("*").order("created_at", { ascending: false }).limit(300);
    if (agentFilter) query = query.eq("agent_id", agentFilter);
    if (meetingFilter) query = query.eq("meeting_id", Number(meetingFilter));
    return query;
  });

  const byId = useMemo(() => new Map(agents.rows.map(a => [a.id, a])), [agents.rows]);
  const messageById = useMemo(() => new Map(messages.rows.map(m => [m.id, m])), [messages.rows]);
  const who = (id: string | null, author?: string | null) =>
    author === "chairman" ? "رئيس مجلس الإدارة" : id ? byId.get(id)?.name ?? id : "النظام";

  const { refresh: refreshMessages } = messages;
  useEffect(() => {
    refreshMessages();
  }, [agentFilter, meetingFilter, refreshMessages]);

  const live = meetings.rows.find(m => m.status === "running");
  const liveMeeting = meetings.rows.find(m => m.status === "running" && m.kind === "live");
  const selected = meetings.rows.find(m => String(m.id) === meetingFilter);
  const active = agents.rows.filter(a => a.status === "active").length;

  return (
    <>
      <HaltedBanner />
      <PageHead
        eyebrow="لايف"
        title="غرفة الاجتماعات"
        subtitle="كل كلمة قالها أي موظف، ومين رد على مين، وبيفكر في إيه."
        actions={live ? <span className="chip signal"><span className="dot" /> فيه اجتماع شغّال دلوقتي</span> : undefined}
      />

      <div className="stats">
        <Stat label="موظفين شغّالين" value={`${active} / ${agents.rows.length}`} />
        <Stat label="كلام النهارده" value={messages.rows.filter(m => isToday(m.created_at)).length} />
        <Stat label="اجتماعات النهارده" value={meetings.rows.filter(m => isToday(m.started_at)).length} />
        <Stat label="مستنية موافقتك" value={pending.rows.length} />
      </div>

      <LiveMeeting meeting={liveMeeting} onStarted={id => { setMeetingFilter(String(id)); meetings.refresh(); }} />

      <div className="panel row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor="agent" style={{ marginTop: 0 }}>الموظف</label>
          <select id="agent" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
            <option value="">كل الموظفين</option>
            {agents.rows.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.title}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor="meeting" style={{ marginTop: 0 }}>الاجتماع</label>
          <select id="meeting" value={meetingFilter} onChange={e => setMeetingFilter(e.target.value)}>
            <option value="">كل النشاط</option>
            {meetings.rows.map(m => (
              <option key={m.id} value={m.id}>
                {m.kind === "live" && m.topic ? `لايف: ${m.topic}` : MEETING_KIND[m.kind] ?? m.kind} — {time(m.started_at)}
                {m.status === "running" ? " (شغّال)" : m.status === "failed" ? " (وقف)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected?.summary && (
        <div className="panel msg decision" style={{ display: "block" }}>
          <h2>ملخص {MEETING_KIND[selected.kind] ?? "الاجتماع"}</h2>
          <p className="msg-text">{selected.summary}</p>
        </div>
      )}

      <div className="panel">
        {messages.error && <p className="error">{messages.error}</p>}
        {!messages.loading && messages.rows.length === 0 && (
          <Empty icon="✦">لسه مفيش كلام. أول اجتماع بيبدأ الساعة 8 الصبح.</Empty>
        )}
        <div className="feed">
          {messages.rows.map(m => {
            const parent = m.reply_to ? messageById.get(m.reply_to) : undefined;
            const agent = m.agent_id ? byId.get(m.agent_id) : undefined;
            const kind = KIND[m.kind];
            return (
              <article key={m.id} className={`msg ${m.kind}`}>
                <Avatar name={who(m.agent_id, m.author)} department={agent?.department} />
                <div className="msg-body">
                  <div className="msg-head">
                    <strong>{who(m.agent_id, m.author)}</strong>
                    {agent && <span className="faint">{agent.title}</span>}
                    <span className={`chip ${kind.cls}`}>{kind.label}</span>
                    {m.confidence && <span className={`chip ${CONFIDENCE[m.confidence].cls}`}>{CONFIDENCE[m.confidence].label}</span>}
                    {m.used_fallback && <span className="chip warn">موديل احتياطي</span>}
                    <span className="faint" style={{ marginInlineStart: "auto" }}>{time(m.created_at)}</span>
                  </div>
                  {m.reply_to && (
                    <div className="reply">
                      ↩ رد على {parent ? `${who(parent.agent_id, parent.author)}: «${parent.content.slice(0, 90)}»` : `رسالة #${m.reply_to}`}
                    </div>
                  )}
                  <p className="msg-text">{m.content}</p>
                  <div className="row" style={{ marginTop: 6 }}>
                    {(m.reasoning || (m.unknowns && m.unknowns.length > 0)) && (
                      <details style={{ flex: "1 1 100%" }}>
                        <summary>بيفكر في إيه</summary>
                        <div>
                          {m.reasoning && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.reasoning}</p>}
                          {m.unknowns && m.unknowns.length > 0 && (
                            <p className="muted" style={{ margin: "6px 0 0" }}>مش متأكد من: {m.unknowns.join("، ")}</p>
                          )}
                          {m.model_key && <p className="faint" style={{ margin: "6px 0 0" }} dir="ltr">{m.model_key}</p>}
                        </div>
                      </details>
                    )}
                    {m.agent_id && (
                      <Link
                        className="faint"
                        href={`/chat?agent=${m.agent_id}&q=${encodeURIComponent(`بخصوص كلامك ده: «${m.content.slice(0, 120)}» — `)}`}
                      >
                        ← اسأله عن الكلام ده
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
