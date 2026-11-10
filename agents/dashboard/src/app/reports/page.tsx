"use client";

import { useState } from "react";
import { PageHead } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useLive } from "@/lib/useLive";

interface DailyReport {
  id: number;
  report_date: string;
  headline: string;
  body: string;
}

// تحويل بسيط للـ markdown اللي التقرير بيتكتب بيه (عناوين وقوائم بس)
function Markdown({ text }: { text: string }) {
  return (
    <div className="report">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i}>{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} style={{ marginTop: 16 }}>{line.slice(3)}</h2>;
        if (line.startsWith("- ")) return <div key={i} className="li">{line.slice(2)}</div>;
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        return <p key={i} style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{line.replace(/^_|_$/g, "")}</p>;
      })}
    </div>
  );
}

export default function ReportsPage() {
  const reports = useLive<DailyReport>("daily_reports", () =>
    supabase().from("daily_reports").select("*").order("report_date", { ascending: false }).limit(60),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const current = reports.rows.find(r => r.id === selected) ?? reports.rows[0];

  return (
    <>
      <PageHead eyebrow="كل يوم الساعة 4" title="التقارير اليومية" subtitle="الأرقام الحقيقية من قاعدة البيانات، والرسايل، والقرارات، واللي محتاج موافقتك." />
      {reports.error && <p className="error">{reports.error}</p>}
      {!reports.loading && reports.rows.length === 0 && (
        <p className="panel muted">لسه مفيش تقارير. أول تقرير بيطلع بعد اجتماع آخر اليوم.</p>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        {reports.rows.slice(0, 14).map(r => (
          <button key={r.id} className={current?.id === r.id ? "primary" : ""} onClick={() => setSelected(r.id)}>
            {r.report_date}
          </button>
        ))}
      </div>
      {current && (
        <div className="panel">
          <p className="chip signal" style={{ whiteSpace: "normal" }}>{current.headline}</p>
          <Markdown text={current.body} />
        </div>
      )}
    </>
  );
}
