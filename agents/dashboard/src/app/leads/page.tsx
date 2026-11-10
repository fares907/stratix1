"use client";

import { Fragment, useState } from "react";
import { PageHead } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/lib/types";
import { useLive } from "@/lib/useLive";

const STATUSES: Record<string, string> = {
  new: "جديد",
  qualified: "مؤهَّل",
  rejected: "مستبعد",
  contacted: "اتكلّمنا معاه",
  replied: "رد",
  interested: "مهتم",
  won: "بقى عميل",
  lost: "مش مهتم",
  unsubscribed: "لغى الاشتراك",
};

interface Outreach {
  id: number;
  lead_id: number;
  direction: "out" | "in";
  channel: string;
  body: string;
  status: string;
  created_at: string;
}

export default function LeadsPage() {
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const leads = useLive<Lead>(
    "leads",
    () => supabase().from("leads").select("*").order("created_at", { ascending: false }).limit(500),
    60_000,
  );
  const messages = useLive<Outreach>(
    "outreach_messages",
    () => supabase().from("outreach_messages").select("*").order("created_at", { ascending: true }).limit(1000),
    60_000,
  );

  const rows = leads.rows.filter(l => !status || l.status === status);
  const counts = leads.rows.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHead eyebrow="بنها" title={`العملاء المحتملين (${leads.rows.length})`} subtitle="محلات ومطاعم مالهاش موقع، لقاها الكشّاف على الخريطة." />
      <div className="segmented" style={{ marginBottom: 16 }}>
        <button className={!status ? "primary" : ""} onClick={() => setStatus("")}>
          الكل
        </button>
        {Object.entries(STATUSES).map(([k, v]) =>
          counts[k] ? (
            <button key={k} className={status === k ? "primary" : ""} onClick={() => setStatus(k)}>
              {v} ({counts[k]})
            </button>
          ) : null,
        )}
      </div>
      {leads.error && <p className="error">{leads.error}</p>}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>النوع</th>
              <th>التواصل</th>
              <th>الحالة</th>
              <th>الرسايل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(l => {
              const thread = messages.rows.filter(m => m.lead_id === l.id);
              return (
                <Fragment key={l.id}>
                  <tr>
                    <td>
                      {l.name}
                      {l.lat && l.lon && (
                        <>
                          {" "}
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lon}#map=19/${l.lat}/${l.lon}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            خريطة
                          </a>
                        </>
                      )}
                    </td>
                    <td className="muted">{l.category}</td>
                    <td dir="ltr" style={{ textAlign: "end" }}>
                      {l.phone && <div>{l.phone}</div>}
                      {l.email && <div>{l.email}</div>}
                    </td>
                    <td>
                      <span className="chip">{STATUSES[l.status] ?? l.status}</span>
                    </td>
                    <td>
                      {thread.length > 0 ? (
                        <button onClick={() => setOpen(open === l.id ? null : l.id)}>{thread.length} رسالة</button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                  {open === l.id && (
                    <tr>
                      <td colSpan={5}>
                        {thread.map(m => (
                          <div key={m.id} className={`msg ${m.direction === "in" ? "decision" : ""}`}>
                            <div className="muted">
                              {m.direction === "out" ? "إحنا" : "العميل"} · {m.channel} · {m.status} ·{" "}
                              {new Date(m.created_at).toLocaleString("ar-EG")}
                            </div>
                            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.body}</p>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
