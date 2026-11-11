"use client";

// التقرير اليومي كمستند رسمي: نفس الشكل على الشاشة وفي الـ PDF.

export interface ReportData {
  version: number;
  date: string;
  summary: string;
  kpis: { label: string; value: string | number; hint?: string; tone?: "ok" | "warn" }[];
  highlights: string[];
  risks: string[];
  recommendations: string[];
  finance: string;
  finance_raw: string;
  sales: { rows: [string, number][] };
  site: { area: string; status: "ok" | "warn" | "critical"; status_label: string; text: string }[];
  ideas: { who: string; idea: string; status: string; reason: string }[];
  meeting_summary: string;
  tasks_done: { who: string; role: string; title: string; result: string }[];
  tasks_open: { who: string; title: string }[];
  approvals: string[];
}

const IDEA = {
  approved: { label: "معتمدة", cls: "ok" },
  rejected: { label: "مرفوضة", cls: "critical" },
  pending: { label: "قيد الدراسة", cls: "warn" },
} as Record<string, { label: string; cls: string }>;

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="doc-section">
      <h2>
        <span className="doc-num">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// نتيجة المهمة ممكن تكون فيها عناوين ونقط بسيطة
function Prose({ text }: { text: string }) {
  return (
    <div className="doc-prose">
      {text.split("\n").filter(l => l.trim()).map((line, i) => {
        const clean = line.replace(/\*\*/g, "").replace(/^#+\s*/, "");
        if (/^\s*[-•*]\s+/.test(line)) return <div key={i} className="doc-li">{clean.replace(/^\s*[-•*]\s+/, "")}</div>;
        if (/^#+\s/.test(line)) return <h4 key={i}>{clean}</h4>;
        return <p key={i}>{clean}</p>;
      })}
    </div>
  );
}

export function ReportDocument({ data }: { data: ReportData }) {
  let n = 0;
  const finance = data.finance || data.finance_raw;
  return (
    <article className="doc" dir="rtl">
      <header className="doc-head">
        <div className="doc-brand">
          <span className="doc-logo">S</span>
          <div>
            <strong>STRATIX</strong>
            <span>لتصميم وتطوير المواقع</span>
          </div>
        </div>
        <div className="doc-meta">
          <span className="doc-kind">التقرير اليومي</span>
          <span>{longDate(data.date)}</span>
        </div>
      </header>
      <div className="doc-to">
        إلى: السيد/ فارس والسيد/ يوسف — رئيسَي مجلس الإدارة
        <span>من: نادر، المدير التنفيذي</span>
      </div>

      <Section n={++n} title="الملخص التنفيذي">
        <p className="doc-lead">{data.summary}</p>
      </Section>

      <Section n={++n} title="المؤشرات الرئيسية">
        <div className="doc-kpis">
          {data.kpis.map(k => (
            <div key={k.label} className={`doc-kpi ${k.tone ?? ""}`}>
              <span className="doc-kpi-label">{k.label}</span>
              <strong>{k.value}</strong>
              {k.hint && <small>{k.hint}</small>}
            </div>
          ))}
        </div>
      </Section>

      {(data.highlights.length > 0 || data.risks.length > 0) && (
        <Section n={++n} title="أبرز الوقائع والمخاطر">
          <div className="doc-two">
            <div>
              <h3>أبرز ما تم</h3>
              {data.highlights.length ? data.highlights.map((h, i) => <div key={i} className="doc-li ok">{h}</div>) : <p className="doc-muted">لا يوجد.</p>}
            </div>
            <div>
              <h3>المخاطر والملاحظات</h3>
              {data.risks.length ? data.risks.map((h, i) => <div key={i} className="doc-li warn">{h}</div>) : <p className="doc-muted">لا توجد مخاطر مسجّلة.</p>}
            </div>
          </div>
        </Section>
      )}

      <Section n={++n} title="المبيعات والتواصل مع العملاء">
        <table className="doc-table">
          <tbody>
            {data.sales.rows.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="doc-val">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {finance && (
        <Section n={++n} title="الوضع المالي">
          <Prose text={finance} />
        </Section>
      )}

      <Section n={++n} title="الموقع والأمان">
        <table className="doc-table">
          <thead>
            <tr>
              <th>المجال</th>
              <th>البند</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {data.site.length === 0 && (
              <tr>
                <td colSpan={3} className="doc-muted">لم يُجرَ فحص اليوم.</td>
              </tr>
            )}
            {data.site.map((c, i) => (
              <tr key={i}>
                <td>{c.area}</td>
                <td>{c.text}</td>
                <td><span className={`doc-pill ${c.status}`}>{c.status_label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {(data.ideas.length > 0 || data.meeting_summary) && (
        <Section n={++n} title="قرارات الاجتماعات">
          {data.ideas.length > 0 && (
            <table className="doc-table">
              <thead>
                <tr>
                  <th>صاحب المقترح</th>
                  <th>المقترح</th>
                  <th>القرار</th>
                </tr>
              </thead>
              <tbody>
                {data.ideas.map((i, k) => (
                  <tr key={k}>
                    <td className="doc-nowrap">{i.who}</td>
                    <td>
                      {i.idea}
                      {i.reason && <div className="doc-muted">السبب: {i.reason}</div>}
                    </td>
                    <td><span className={`doc-pill ${IDEA[i.status]?.cls ?? ""}`}>{IDEA[i.status]?.label ?? i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {data.tasks_done.length > 0 && (
        <Section n={++n} title="المهام المُنجزة اليوم">
          {data.tasks_done.map((t, i) => (
            <div key={i} className="doc-task">
              <div className="doc-task-head">
                <strong>{t.title}</strong>
                <span>{t.who}{t.role ? ` — ${t.role}` : ""}</span>
              </div>
              <Prose text={t.result} />
            </div>
          ))}
        </Section>
      )}

      {data.recommendations.length > 0 && (
        <Section n={++n} title="التوصيات">
          <ol className="doc-ol">
            {data.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ol>
        </Section>
      )}

      <Section n={++n} title="بانتظار موافقتكم">
        {data.approvals.length ? (
          <ol className="doc-ol">{data.approvals.map((a, i) => <li key={i}>{a}</li>)}</ol>
        ) : (
          <p className="doc-muted">لا توجد قرارات معلّقة.</p>
        )}
        {data.tasks_open.length > 0 && (
          <p className="doc-muted" style={{ marginTop: 10 }}>
            مهام قيد التنفيذ: {data.tasks_open.length} مهمة ({data.tasks_open.slice(0, 5).map(t => `${t.who}: ${t.title}`).join("، ")}
            {data.tasks_open.length > 5 ? "، ..." : ""}).
          </p>
        )}
      </Section>

      <footer className="doc-foot">
        <span>أُعدّ هذا التقرير آليًا من بيانات الشركة الفعلية؛ جميع الأرقام مستخرجة من قاعدة البيانات مباشرةً.</span>
        <span>STRATIX · stratix.website</span>
      </footer>
    </article>
  );
}
