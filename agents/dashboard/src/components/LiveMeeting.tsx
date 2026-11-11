"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface LiveMeetingRow {
  id: number;
  kind: string;
  status: string;
  topic: string | null;
  ends_at: string | null;
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase().functions.invoke("team-meeting", { body });
  if (error) {
    let message = "حصلت مشكلة، جرّب تاني";
    try {
      const b = await (error as { context?: Response }).context?.json();
      if (b?.error) message = b.error;
    } catch {
      /* رسالة عامة */
    }
    throw new Error(message);
  }
  return data;
}

const left = (endsAt: string | null) => {
  if (!endsAt) return "";
  const s = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// الاجتماع اللايف: رئيس مجلس الإدارة يبدأ اجتماع دلوقتي بمدة، ويتكلم مع الفريق كله ونادر بيديره.
export function LiveMeeting({ meeting, onStarted }: { meeting?: LiveMeetingRow; onStarted: (id: number) => void }) {
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "start" | "say" | "close">("");
  const [error, setError] = useState("");
  const [, tick] = useState(0);
  const closing = useRef(false);

  useEffect(() => {
    if (!meeting) return;
    const timer = setInterval(() => tick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [meeting]);

  async function run(kind: "start" | "say" | "close", body: Record<string, unknown>) {
    setBusy(kind);
    setError("");
    try {
      const data = await call(body);
      if (kind === "start" && data?.meeting_id) onStarted(data.meeting_id);
      if (kind === "say") setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // لما الوقت يخلص نادر يقفل الاجتماع لوحده
  const expired = Boolean(meeting?.ends_at && new Date(meeting.ends_at).getTime() <= Date.now());
  useEffect(() => {
    if (meeting && expired && !closing.current && !busy) {
      closing.current = true;
      run("close", { action: "close", meeting_id: meeting.id });
    }
  });

  if (!meeting) {
    return (
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>اجتماع لايف مع الفريق</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          ابدأ اجتماع دلوقتي (طوارئ أو أي موضوع). نادر هيديره، وكل كلمة تقولها الفريق كله هيسمعها ويرد عليك.
        </p>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: "3 1 240px" }}>
            <label htmlFor="topic" style={{ marginTop: 0 }}>الموضوع</label>
            <input id="topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="مثلًا: اجتماع طوارئ — مفيش عملاء جداد" />
          </div>
          <div style={{ flex: "1 1 110px" }}>
            <label htmlFor="minutes" style={{ marginTop: 0 }}>المدة (دقيقة)</label>
            <select id="minutes" value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
              {[5, 10, 15, 20, 30, 45, 60].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <button className="primary" disabled={Boolean(busy)} onClick={() => run("start", { action: "start", topic, minutes })}>
            {busy === "start" ? "نادر بيجمّع الفريق…" : "ابدأ اجتماع دلوقتي"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="panel" style={{ borderColor: "var(--signal)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>
          <span className="dot" /> اجتماع لايف: {meeting.topic}
        </h2>
        <span className="row">
          <span className="chip signal" dir="ltr">⏱ {expired ? "0:00" : left(meeting.ends_at)}</span>
          <button disabled={Boolean(busy)} onClick={() => run("close", { action: "close", meeting_id: meeting.id })}>
            {busy === "close" ? "نادر بيقفل…" : "إنهاء الاجتماع"}
          </button>
        </span>
      </div>
      <div className="chat-input" style={{ marginTop: 12, borderRadius: 12 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="اتكلم مع الفريق كله بصفتك رئيس مجلس الإدارة…"
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey && text.trim() && !busy) {
              e.preventDefault();
              run("say", { action: "say", meeting_id: meeting.id, text });
            }
          }}
        />
        <button className="primary" disabled={!text.trim() || Boolean(busy)} onClick={() => run("say", { action: "say", meeting_id: meeting.id, text })}>
          {busy === "say" ? "الفريق بيرد…" : "قول"}
        </button>
      </div>
      {busy === "say" && <p className="muted">نادر بيسمعك وبيطلب رأي اللي يخصهم الكلام… الردود بتظهر تحت أول بأول.</p>}
      {busy === "close" && <p className="muted">نادر بيكتب الملخص والقرارات ويوزّع المهام…</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
