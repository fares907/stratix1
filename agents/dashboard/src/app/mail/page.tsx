"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/lib/types";
import { useLive } from "@/lib/useLive";

interface Outreach {
  id: number;
  lead_id: number;
  agent_id: string;
  channel: "email" | "whatsapp";
  direction: "out" | "in";
  subject: string | null;
  body: string;
  status: "draft" | "held" | "sent" | "failed" | "received";
  sent_at: string | null;
  created_at: string;
}

const STATUS = { draft: "جاهزة", held: "مستنية موافقة", sent: "اتبعتت", failed: "فشلت", received: "وصلت" };

function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.split(/[;,/]/)[0].replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = "20" + d.slice(1);
  return d.startsWith("20") && d.length === 12 ? d : null;
}

// البريد: كل رسالة الـ agents بعتوها وكل رد وصل، ورسايل الواتساب الجاهزة بزرار.
export default function MailPage() {
  const [tab, setTab] = useState<"all" | "in" | "whatsapp" | "held">("all");
  const leads = useLive<Lead>("leads", () => supabase().from("leads").select("id, name, phone, email"), 60_000);
  const mail = useLive<Outreach>("outreach_messages", () =>
    supabase().from("outreach_messages").select("*").order("created_at", { ascending: false }).limit(500),
  );
  const byId = useMemo(() => new Map(leads.rows.map(l => [l.id, l])), [leads.rows]);

  const rows = mail.rows.filter(m =>
    tab === "all" ? true
    : tab === "in" ? m.direction === "in"
    : tab === "whatsapp" ? m.channel === "whatsapp" && m.status === "draft"
    : m.status === "held",
  );
  const count = (t: typeof tab) =>
    mail.rows.filter(m =>
      t === "in" ? m.direction === "in" : t === "whatsapp" ? m.channel === "whatsapp" && m.status === "draft" : m.status === "held",
    ).length;

  async function markSent(id: number) {
    await supabase().from("outreach_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
  }

  return (
    <>
      <h1>البريد والرسايل</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={tab === "all" ? "primary" : ""} onClick={() => setTab("all")}>الكل</button>
        <button className={tab === "in" ? "primary" : ""} onClick={() => setTab("in")}>ردود العملاء ({count("in")})</button>
        <button className={tab === "whatsapp" ? "primary" : ""} onClick={() => setTab("whatsapp")}>واتساب جاهزة ({count("whatsapp")})</button>
        <button className={tab === "held" ? "primary" : ""} onClick={() => setTab("held")}>مستنية موافقة ({count("held")})</button>
      </div>
      {mail.error && <p className="error">{mail.error}</p>}
      {rows.length === 0 && <p className="panel muted">مفيش رسايل هنا.</p>}
      {rows.map(m => {
        const lead = byId.get(m.lead_id);
        const wa = m.channel === "whatsapp" && m.status === "draft" ? waNumber(lead?.phone ?? null) : null;
        return (
          <div key={m.id} className={`panel msg ${m.direction === "in" ? "decision" : m.status === "held" ? "objection" : ""}`}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>
                {m.direction === "in" ? "← من " : "→ لـ "}
                {lead?.name ?? `عميل #${m.lead_id}`}
              </strong>
              <div className="row">
                <span className="chip">{m.channel === "email" ? "إيميل" : "واتساب"}</span>
                <span className={`chip ${m.status === "failed" ? "danger" : m.status === "held" ? "warn" : ""}`}>{STATUS[m.status]}</span>
              </div>
            </div>
            <div className="muted">
              {m.direction === "out" ? `كتبها ${m.agent_id}` : "رد العميل"} ·{" "}
              {new Date(m.sent_at ?? m.created_at).toLocaleString("ar-EG")}
              {m.subject && ` · ${m.subject}`}
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
            {wa && (
              <div className="row">
                <a className="btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(m.body)}`} target="_blank" rel="noreferrer">
                  افتح في واتساب
                </a>
                <button onClick={() => markSent(m.id)}>بعتّها ✓</button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
