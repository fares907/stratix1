"use client";

import { useRef, useState } from "react";
import { downloadPdf } from "@/lib/pdf";
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
        if (line.startsWith("### ")) return <h3 key={i} style={{ margin: "14px 0 4px", fontSize: "0.95rem", color: "var(--signal-bright)" }}>{line.slice(4)}</h3>;
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
  const sheet = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  async function exportPdf() {
    if (!sheet.current || !current) return;
    setExporting(true);
    setExportError("");
    try {
      await downloadPdf(sheet.current, `STRATIX-report-${current.report_date}`);
    } catch {
      setExportError("ماقدرتش أعمل الـ PDF، جرّب تاني");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHead eyebrow="كل يوم آخر اليوم — وتقدر تنزّله PDF" title="التقارير اليومية" subtitle="الأرقام الحقيقية من قاعدة البيانات، والرسايل، والقرارات، واللي محتاج موافقتك." />
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
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="primary" onClick={exportPdf} disabled={exporting}>
              {exporting ? "بيتعمل…" : "⬇ تحميل التقرير PDF"}
            </button>
            {exportError && <span className="error">{exportError}</span>}
          </div>
          <div className="panel" ref={sheet}>
            <p className="faint" style={{ margin: "0 0 8px", letterSpacing: "0.2em" }}>STRATIX</p>
            <p className="chip signal" style={{ whiteSpace: "normal" }}>{current.headline}</p>
            <Markdown text={current.body} />
          </div>
        </>
      )}
    </>
  );
}
