"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Empty, PageHead, Person } from "@/components/ui";
import { Dictation, type ListenerState, Speaker } from "@/lib/voice";
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
  const [voiceReply, setVoiceReply] = useState(false);
  const [dictating, setDictating] = useState<ListenerState>("off");
  const [voiceError, setVoiceError] = useState("");
  const voice = useRef<{ speaker: Speaker; dictation: Dictation } | null>(null);
  useEffect(() => {
    const speaker = new Speaker();
    const dictation = new Dictation();
    dictation.onState = setDictating;
    dictation.onError = setVoiceError;
    dictation.onText = t => setDraft(prev => (prev ? `${prev} ${t}` : t));
    voice.current = { speaker, dictation };
    return () => {
      speaker.stop();
      dictation.cancel();
    };
  }, []);
  // كل قراءة بصوت ليها رقم مختلف عشان تتقري مرة واحدة بس
  const sayAloud = (text: string) => {
    voice.current?.speaker.stop();
    voice.current?.speaker.enqueue(-Date.now(), text, agentId);
  };

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
    voice.current?.dictation.cancel();
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
    if (voiceReply) sayAloud(String(data.reply).replace(/^✅.*$/gm, ""));
  }

  return (
    <>
      <PageHead
        eyebrow="كلام مباشر"
        title="كلّم الموظفين"
        subtitle="اسأل أي موظف عن شغله أو قراراته، واديله توجيهات بياخدها في الاجتماع الجاي."
      />
      <div className="chat">
        <aside className="panel agent-list">
          {agents.rows.map(a => (
            <button key={a.id} onClick={() => setAgentId(a.id)} className={a.id === agentId ? "primary" : ""}>
              <Person name={a.name} title={a.title} department={a.department} size="sm" />
            </button>
          ))}
        </aside>

        <section className="panel chat-window">
          <div className="chat-head">
            {agent ? <Person name={agent.name} title={agent.title} department={agent.department} /> : <strong>{agentId}</strong>}
            {agent?.status === "paused" && <span className="chip warn">موقوف مؤقتًا</span>}
          </div>
          <div className="chat-scroll">
            {chats.rows.length === 0 && !pending && (
              <Empty icon="✦">
                اسأله عن أي حاجة: «ليه وافقت على الفكرة دي؟»، «إيه أكبر مشكلة عندك؟».
                <br />
                وأي توجيه تقوله بياخده في اعتباره في الاجتماع الجاي.
              </Empty>
            )}
            {chats.rows.map(c => (
              <div key={c.id} className={`bubble ${c.role === "owner" ? "mine" : "theirs"}`}>
                {c.content}
                {c.role === "agent" && (
                  <div className="meta">
                    <button type="button" className="faint" style={{ padding: "2px 8px", fontSize: "0.8rem" }} onClick={() => sayAloud(c.content)}>
                      🔊 اسمعه
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pending && (
              <>
                <div className="bubble mine">{pending}</div>
                <div className="typing">{agent?.name ?? "الموظف"} بيكتب…</div>
              </>
            )}
            <div ref={bottom} />
          </div>
          {error && <p className="error" style={{ margin: "0 16px 8px" }}>{error}</p>}
          <form onSubmit={send} className="chat-input">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={dictating !== "off" ? "بسجّل… اتكلم براحتك، ولما تخلص دوس على المربع" : `اكتب أو سجّل بصوتك لـ${agent?.name ?? "الموظف"}…`}
              rows={1}
            />
            <button
              type="button"
              className={dictating !== "off" ? "mic on" : "mic"}
              title={dictating !== "off" ? "خلصت" : "سجّل بصوتك"}
              disabled={sending || dictating === "transcribing"}
              onClick={() => {
                if (dictating !== "off") voice.current?.dictation.stop();
                else {
                  voice.current?.speaker.stop();
                  void voice.current?.dictation.start();
                }
              }}
            >
              {dictating === "transcribing" ? "…" : dictating !== "off" ? "■" : "🎙"}
            </button>
            <button className="primary" type="submit" disabled={sending || !draft.trim()}>
              ابعت
            </button>
          </form>
          <div className="voice-bar" style={{ padding: "0 12px 10px" }}>
            <label>
              <input type="checkbox" checked={voiceReply} onChange={e => { setVoiceReply(e.target.checked); if (!e.target.checked) voice.current?.speaker.stop(); }} />
              {agent?.name ?? "الموظف"} يرد عليا بصوت
            </label>
            {dictating === "waiting" || dictating === "hearing" ? <span className="listening-hint">● بسجّل… مش هقطع عليك لو سكت، دوس ■ لما تخلص</span> : null}
            {dictating === "transcribing" && <span className="muted">بكتب كلامك…</span>}
            {voiceError && <span className="error">{voiceError}</span>}
          </div>
        </section>
      </div>
    </>
  );
}
