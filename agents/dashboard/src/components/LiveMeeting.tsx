"use client";

import { useEffect, useRef, useState } from "react";
import { MicButton } from "@/components/MicButton";
import { canSpeak, speak, stopSpeaking, useDictation, voiceFor } from "@/lib/speech";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";
import { useLive } from "@/lib/useLive";

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

  // ── الصوت: وضع المكالمة (تتكلم وهما يردوا بصوت) ──
  const [callMode, setCallMode] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const meetingId = meeting?.id ?? 0;
  const msgs = useLive<Message>("messages", () =>
    supabase().from("messages").select("*").eq("meeting_id", meetingId).order("id"),
  );
  const { refresh: refreshMsgs } = msgs;
  useEffect(() => {
    refreshMsgs();
  }, [meetingId, refreshMsgs]);
  const spokenUpTo = useRef<number | null>(null);
  const queue = useRef<Message[]>([]);
  const playing = useRef(false);

  const dictation = useDictation(
    t => setText(t),
    t => {
      if (callMode && meeting && t.trim()) run("say", { action: "say", meeting_id: meeting.id, text: t });
    },
  );

  async function playQueue() {
    if (playing.current) return;
    playing.current = true;
    setSpeaking(true);
    while (queue.current.length) {
      const m = queue.current.shift()!;
      await speak(m.content, voiceFor(m.agent_id));
    }
    playing.current = false;
    setSpeaking(false);
  }

  // أي رد جديد من الفريق في الاجتماع ده يتقري بصوت (من غير ما يعيد الكلام القديم)
  useEffect(() => {
    const rows = msgs.rows.filter(m => m.meeting_id === meetingId);
    const last = rows.length ? rows[rows.length - 1].id : 0;
    if (spokenUpTo.current === null) {
      spokenUpTo.current = last;
      return;
    }
    const fresh = rows.filter(m => m.id > (spokenUpTo.current ?? 0) && m.author !== "chairman" && m.agent_id);
    spokenUpTo.current = Math.max(spokenUpTo.current, last);
    if (voiceOn && canSpeak() && fresh.length) {
      queue.current.push(...fresh);
      playQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.rows, meetingId, voiceOn]);

  useEffect(() => {
    spokenUpTo.current = null;
  }, [meetingId]);

  // في وضع المكالمة: لما الفريق يخلص كلام والرد يوصل، المايك يفتح تاني لوحده
  useEffect(() => {
    if (callMode && meeting && !busy && !speaking && !dictation.listening) {
      const t = setTimeout(() => dictation.start(), 600);
      return () => clearTimeout(t);
    }
    if ((busy || speaking) && dictation.listening) dictation.stop();
  }, [callMode, meeting, busy, speaking, dictation]);

  useEffect(() => () => { stopSpeaking(); }, []);

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
          placeholder="اكتب أو دوس على المايك واتكلم مع الفريق كله بصفتك رئيس مجلس الإدارة…"
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey && text.trim() && !busy) {
              e.preventDefault();
              run("say", { action: "say", meeting_id: meeting.id, text });
            }
          }}
        />
        <MicButton
          listening={dictation.listening}
          supported={dictation.supported}
          disabled={Boolean(busy)}
          onStart={() => { stopSpeaking(); dictation.start(text); }}
          onStop={dictation.stop}
        />
        <button className="primary" disabled={!text.trim() || Boolean(busy)} onClick={() => { dictation.stop(); run("say", { action: "say", meeting_id: meeting.id, text }); }}>
          {busy === "say" ? "الفريق بيرد…" : "قول"}
        </button>
      </div>
      <div className="voice-bar">
        {dictation.supported && (
          <button
            className={callMode ? "primary" : ""}
            onClick={() => {
              if (callMode) { setCallMode(false); dictation.stop(); } else { setCallMode(true); setVoiceOn(true); }
            }}
          >
            {callMode ? "📞 قفّل المكالمة الصوتية" : "📞 كلّمهم بصوتك (مكالمة)"}
          </button>
        )}
        {canSpeak() && (
          <label>
            <input type="checkbox" checked={voiceOn} onChange={e => { setVoiceOn(e.target.checked); if (!e.target.checked) { queue.current = []; stopSpeaking(); } }} />
            ردودهم بصوت
          </label>
        )}
        {speaking && <button onClick={() => { queue.current = []; stopSpeaking(); }}>🔇 اسكّتهم</button>}
        {dictation.listening && <span className="listening-hint">● بسمعك… اتكلم{callMode ? " وأول ما تسكت هبعت كلامك" : ""}</span>}
        {!dictation.supported && <span className="muted">التسجيل الصوتي محتاج متصفح كروم.</span>}
      </div>
      {dictation.error && <p className="error">{dictation.error}</p>}
      {busy === "say" && <p className="muted">نادر بيسمعك وبيطلب رأي اللي يخصهم الكلام… الردود بتظهر تحت أول بأول.</p>}
      {busy === "close" && <p className="muted">نادر بيكتب الملخص والقرارات ويوزّع المهام…</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
