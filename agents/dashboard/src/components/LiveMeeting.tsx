"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";
import { useLive } from "@/lib/useLive";
import { Dictation, groqVoiceProblem, Listener, type ListenerState, Speaker } from "@/lib/voice";

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

const CALL_LABEL: Record<"listening" | "hearing" | "transcribing" | "thinking" | "speaking", string> = {
  listening: "سامعك… اتكلم براحتك",
  hearing: "بسمعك… كمّل، ومش هبعت غير لما تسكت",
  transcribing: "بكتب كلامك…",
  thinking: "نادر بيسمعك والفريق بيفكر…",
  speaking: "الفريق بيتكلم — المايك مقفول لحد ما يخلصوا",
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
  const meetingId = meeting?.id ?? 0;

  // ── الصوت ──
  const [inCall, setInCall] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [listenState, setListenState] = useState<ListenerState>("off");
  const [heard, setHeard] = useState("");
  const [hold, setHold] = useState(false);
  const [silence, setSilence] = useState(3.5);
  const [dictating, setDictating] = useState<ListenerState>("off");
  const [level, setLevel] = useState(0);
  const speaker = useRef<Speaker | null>(null);
  const listener = useRef<Listener | null>(null);
  const dictation = useRef<Dictation | null>(null);
  const sendRef = useRef<(t: string) => void>(() => {});

  if (typeof window !== "undefined" && !speaker.current) {
    speaker.current = new Speaker();
    listener.current = new Listener();
    dictation.current = new Dictation();
  }

  const msgs = useLive<Message>("messages", () =>
    supabase().from("messages").select("*").eq("meeting_id", meetingId).order("id"),
  );
  const { refresh: refreshMsgs } = msgs;
  useEffect(() => {
    refreshMsgs();
  }, [meetingId, refreshMsgs]);

  // كل اللي اتقال قبل ما تفتح الصفحة/المكالمة مابيتقريش؛ الجديد بس، ومرة واحدة
  const primed = useRef(0);
  useEffect(() => {
    const sp = speaker.current;
    if (!sp) return;
    const rows = msgs.rows.filter(m => m.meeting_id === meetingId);
    if (primed.current !== meetingId) {
      if (msgs.loading) return;
      sp.markSeen(rows.map(m => m.id));
      primed.current = meetingId;
      return;
    }
    for (const m of rows) {
      if (m.author === "chairman" || !m.agent_id) {
        sp.markSeen([m.id]);
        continue;
      }
      if (voiceOn) sp.enqueue(m.id, m.content, m.agent_id);
      else sp.markSeen([m.id]);
    }
  }, [msgs.rows, msgs.loading, meetingId, voiceOn]);

  useEffect(() => {
    const sp = speaker.current!;
    const li = listener.current!;
    const di = dictation.current!;
    sp.onChange = setSpeaking;
    li.onState = setListenState;
    li.onPartial = setHeard;
    li.onError = setError;
    li.onUtterance = t => sendRef.current(t);
    di.onState = setDictating;
    di.onError = setError;
    di.onText = t => setText(prev => (prev ? `${prev} ${t}` : t));
    return () => {
      sp.stop();
      li.close();
      di.cancel();
    };
  }, []);

  useEffect(() => {
    if (listener.current) listener.current.hold = hold;
  }, [hold]);
  useEffect(() => {
    if (listener.current) listener.current.silenceMs = silence * 1000;
  }, [silence]);

  // المكالمة: المايك يفتح بس لما الفريق ساكت ومفيش رد مستني. وهما بيتكلموا مقفول خالص.
  useEffect(() => {
    const li = listener.current;
    if (!li) return;
    if (!inCall || !meeting) {
      li.close();
      return;
    }
    if (busy || speaking) {
      if (li.state === "waiting" || li.state === "hearing") li.pause();
      return;
    }
    if (li.state === "off") {
      const t = setTimeout(() => void li.listen(), 700);
      return () => clearTimeout(t);
    }
  }, [inCall, meeting, busy, speaking, listenState]);

  // مؤشر الصوت: تشوف إن المايك سامعك
  useEffect(() => {
    if (!inCall) return;
    const t = setInterval(() => setLevel(listener.current?.level ?? 0), 120);
    return () => clearInterval(t);
  }, [inCall]);

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

  sendRef.current = (t: string) => {
    if (!meeting || !t.trim() || busy) return;
    void run("say", { action: "say", meeting_id: meeting.id, text: t, voice: inCall });
  };

  // لما الوقت يخلص نادر يقفل الاجتماع لوحده
  const expired = Boolean(meeting?.ends_at && new Date(meeting.ends_at).getTime() <= Date.now());
  useEffect(() => {
    if (meeting && expired && !closing.current && !busy) {
      closing.current = true;
      setInCall(false);
      void run("close", { action: "close", meeting_id: meeting.id });
    }
  });

  if (!meeting) {
    return (
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>اجتماع لايف مع الفريق</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          ابدأ اجتماع دلوقتي (طوارئ أو أي موضوع). نادر هيديره، وتقدر تكلّمهم بصوتك زي المكالمة.
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

  const callPhase = speaking ? "speaking" : busy === "say" ? "thinking" : listenState === "transcribing" ? "transcribing"
    : listenState === "hearing" ? "hearing" : "listening";

  return (
    <div className="panel" style={{ borderColor: "var(--signal)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>
          <span className="dot" /> اجتماع لايف: {meeting.topic}
        </h2>
        <span className="row">
          <span className="chip signal" dir="ltr">⏱ {expired ? "0:00" : left(meeting.ends_at)}</span>
          <button disabled={Boolean(busy)} onClick={() => { setInCall(false); void run("close", { action: "close", meeting_id: meeting.id }); }}>
            {busy === "close" ? "نادر بيقفل…" : "إنهاء الاجتماع"}
          </button>
        </span>
      </div>

      {inCall ? (
        <div className={`call call-${callPhase}`}>
          <div className="call-orb" aria-hidden />
          <p className="call-label">{CALL_LABEL[callPhase]}</p>
          {(callPhase === "listening" || callPhase === "hearing") && (
            <div className="mic-level" aria-hidden><span style={{ width: `${Math.round(level * 100)}%` }} /></div>
          )}
          {heard && <p className="call-heard">«{heard}»</p>}
          <div className="row" style={{ justifyContent: "center" }}>
            {speaking ? (
              <button onClick={() => speaker.current?.stop()}>✋ قاطعهم وخليني أتكلم</button>
            ) : (
              <>
                <button className={hold ? "primary" : ""} onClick={() => setHold(h => !h)} disabled={callPhase === "thinking"}>
                  {hold ? "⏸ مستنيك تخلص — دوس «ابعت» لما تخلص" : "⏸ استنى، لسه بتكلم"}
                </button>
                <button className="primary" onClick={() => { setHold(false); listener.current?.sendImmediately(); }}
                  disabled={callPhase === "thinking" || (!heard && listenState !== "hearing")}>
                  ✔ خلصت، ابعت
                </button>
              </>
            )}
            <button onClick={() => setInCall(false)}>📞 قفّل المكالمة</button>
          </div>
          <div className="voice-bar" style={{ justifyContent: "center" }}>
            <label>
              أبعت بعد ما أسكت
              <select value={silence} onChange={e => setSilence(Number(e.target.value))} style={{ width: "auto" }}>
                <option value={2.5}>ثانيتين ونص</option>
                <option value={3.5}>3 ثواني ونص</option>
                <option value={5}>5 ثواني</option>
                <option value={8}>8 ثواني</option>
              </select>
            </label>
            <span className="muted">وتقدر تقول «استنى» أو «لحظة» وأنا هفضل سامعك.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="chat-input" style={{ marginTop: 12, borderRadius: 12 }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={dictating !== "off" ? "بسجّل… لما تخلص دوس على المربع" : "اكتب أو سجّل بصوتك، وكلّم الفريق كله بصفتك رئيس مجلس الإدارة…"}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && text.trim() && !busy) {
                  e.preventDefault();
                  sendRef.current(text);
                }
              }}
            />
            <button
              type="button"
              className={dictating !== "off" ? "mic on" : "mic"}
              title={dictating !== "off" ? "خلصت" : "سجّل بصوتك"}
              disabled={Boolean(busy) || dictating === "transcribing"}
              onClick={() => (dictating !== "off" ? dictation.current?.stop() : void dictation.current?.start())}
            >
              {dictating === "transcribing" ? "…" : dictating !== "off" ? "■" : "🎙"}
            </button>
            <button className="primary" disabled={!text.trim() || Boolean(busy)} onClick={() => sendRef.current(text)}>
              {busy === "say" ? "الفريق بيرد…" : "قول"}
            </button>
          </div>
          <div className="voice-bar">
            <button className="primary" onClick={() => { setVoiceOn(true); setInCall(true); }}>📞 كلّمهم بصوتك (مكالمة)</button>
            <label>
              <input type="checkbox" checked={voiceOn} onChange={e => { setVoiceOn(e.target.checked); if (!e.target.checked) speaker.current?.stop(); }} />
              ردودهم بصوت
            </label>
            {speaking && <button onClick={() => speaker.current?.stop()}>🔇 اسكّتهم</button>}
          </div>
        </>
      )}

      {groqVoiceProblem === "terms" && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          الصوت البشري الطبيعي محتاج موافقة مرة واحدة على حساب Groq — لحد كده بيتقري بأحسن صوت على جهازك.
        </p>
      )}
      {busy === "say" && !inCall && <p className="muted">نادر بيسمعك وبيطلب رأي اللي يخصهم الكلام… الردود بتظهر تحت أول بأول.</p>}
      {busy === "close" && <p className="muted">نادر بيكتب الملخص والقرارات ويوزّع المهام…</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
