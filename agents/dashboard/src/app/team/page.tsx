"use client";

import { useState, type FormEvent } from "react";
import { PageHead, Person } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { DEPARTMENTS, STATUS_LABEL, TOOLS, type Agent, type AgentStatus, type ModelInfo } from "@/lib/types";
import { useLive } from "@/lib/useLive";

const EMPTY: Agent = {
  id: "",
  name: "",
  title: "",
  department: "sales",
  status: "active",
  primary_model: "",
  fallback_model: "",
  tools: [],
  duties: [],
  instructions: "",
  sensitive: false,
};

export default function TeamPage() {
  const agents = useLive<Agent>("agents", () =>
    supabase().from("agents").select("*").order("department").order("name"),
  );
  const models = useLive<ModelInfo>("model_catalog", () =>
    supabase().from("model_catalog").select("*").order("key"),
  );
  const [editing, setEditing] = useState<Agent | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showFired, setShowFired] = useState(false);

  async function setStatus(agent: Agent, status: AgentStatus) {
    const ask: Record<AgentStatus, string> = {
      active: `ترجّع ${agent.name} للشغل؟`,
      paused: `توقف ${agent.name} مؤقتًا؟`,
      fired: `تقيل ${agent.name}؟ هيقف عن الشغل خالص (وتقدر ترجّعه بعدين).`,
    };
    if (!window.confirm(ask[status])) return;
    const { error } = await supabase().from("agents").update({ status }).eq("id", agent.id);
    if (error) window.alert(error.message);
  }

  const visible = agents.rows.filter(a => showFired || a.status !== "fired");
  const groups = Object.keys(DEPARTMENTS).map(dep => ({
    dep,
    members: visible.filter(a => a.department === dep),
  }));

  return (
    <>
      <PageHead
        eyebrow="الفريق"
        title={`الموظفين (${agents.rows.filter(a => a.status !== "fired").length})`}
        subtitle="عيّن، أقيل، أوقف مؤقتًا، أو غيّر الموديل والتعليمات."
        actions={<>
          <label className="row" style={{ margin: 0 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={showFired}
              onChange={e => setShowFired(e.target.checked)}
            />
            اعرض اللي اتقالوا
          </label>
          <button
            className="primary"
            onClick={() => {
              setIsNew(true);
              setEditing({ ...EMPTY, primary_model: models.rows[0]?.key ?? "", fallback_model: models.rows[1]?.key ?? "" });
            }}
          >
            + تعيين موظف
          </button>
        </>}
      />
      {agents.error && <p className="error">{agents.error}</p>}

      {editing && (
        <AgentForm
          agent={editing}
          isNew={isNew}
          models={models.rows}
          onDone={() => {
            setEditing(null);
            setIsNew(false);
          }}
        />
      )}

      {groups.map(({ dep, members }) =>
        members.length === 0 ? null : (
          <section key={dep} style={{ marginBottom: 22 }}>
            <h2 className="row"><span className="dot" style={{ color: `var(--dep-${dep})` }} /> {DEPARTMENTS[dep]} <span className="faint">({members.length})</span></h2>
            <div className="grid">
              {members.map(a => (
                <div key={a.id} className="panel">
                  <div className="row between" style={{ alignItems: "flex-start" }}>
                    <Person name={a.name} title={a.title} department={a.department} size="lg" />
                    <span className={`chip ${a.status === "active" ? "ok" : a.status === "fired" ? "danger" : "warn"}`}>
                      <span className="dot" /> {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <div className="row" style={{ margin: "12px 0" }}>
                    <span className="chip" dir="ltr">{a.primary_model}</span>
                    <span className="faint">احتياطي</span>
                    <span className="chip" dir="ltr">{a.fallback_model}</span>
                  </div>
                  <div className="row">
                    <button onClick={() => { setIsNew(false); setEditing(a); }}>تعديل</button>
                    {a.status === "active" && <button onClick={() => setStatus(a, "paused")}>إيقاف مؤقت</button>}
                    {a.status !== "active" && <button onClick={() => setStatus(a, "active")}>رجّعه</button>}
                    {a.status !== "fired" && (
                      <button className="danger" onClick={() => setStatus(a, "fired")}>
                        إقالة
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ),
      )}
    </>
  );
}

function AgentForm({
  agent,
  isNew,
  models,
  onDone,
}: {
  agent: Agent;
  isNew: boolean;
  models: ModelInfo[];
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(agent);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Agent>(key: K, value: Agent[K]) => setDraft(d => ({ ...d, [key]: value }));

  const primary = models.find(m => m.key === draft.primary_model);
  const fallback = models.find(m => m.key === draft.fallback_model);
  const warnings: string[] = [];
  if (draft.primary_model === draft.fallback_model) warnings.push("الأساسي والاحتياطي نفس الموديل");
  if (primary && fallback && primary.provider === fallback.provider)
    warnings.push("الاتنين من نفس المزوّد — لو وقع هيقعوا مع بعض");
  if (draft.sensitive && (primary?.trains_on_free_data || fallback?.trains_on_free_data))
    warnings.push("الموظف ده شغال على بيانات حساسة، والموديل ده مش هيتستخدم له (الكود بيتخطاه)");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(draft.id)) {
      setError("الكود لازم يكون حروف إنجليزي صغيرة وأرقام (زي sales_2)");
      return;
    }
    setBusy(true);
    const row = {
      id: draft.id,
      name: draft.name.trim(),
      title: draft.title.trim(),
      department: draft.department,
      primary_model: draft.primary_model,
      fallback_model: draft.fallback_model,
      tools: draft.tools,
      duties: draft.duties.map(d => d.trim()).filter(Boolean),
      instructions: draft.instructions,
      sensitive: draft.sensitive,
    };
    const { error } = isNew
      ? await supabase().from("agents").insert({ ...row, status: "active" })
      : await supabase().from("agents").update(row).eq("id", draft.id);
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <form className="panel" onSubmit={save}>
      <h2>{isNew ? "تعيين موظف جديد" : `تعديل ${agent.name}`}</h2>
      <div className="grid">
        <div>
          <label>الاسم</label>
          <input required value={draft.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label>الدور</label>
          <input required value={draft.title} onChange={e => set("title", e.target.value)} />
        </div>
        <div>
          <label>الكود (إنجليزي)</label>
          <input required disabled={!isNew} dir="ltr" value={draft.id} onChange={e => set("id", e.target.value)} />
        </div>
        <div>
          <label>القسم</label>
          <select value={draft.department} onChange={e => set("department", e.target.value)}>
            {Object.entries(DEPARTMENTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <ModelSelect label="الموديل الأساسي" value={draft.primary_model} models={models} onChange={v => set("primary_model", v)} />
        <ModelSelect label="الموديل الاحتياطي" value={draft.fallback_model} models={models} onChange={v => set("fallback_model", v)} />
      </div>

      <label>المهام اليومية (كل مهمة في سطر)</label>
      <textarea value={draft.duties.join("\n")} onChange={e => set("duties", e.target.value.split("\n"))} />

      <label>تعليمات إضافية</label>
      <textarea value={draft.instructions} onChange={e => set("instructions", e.target.value)} />

      <label>الصلاحيات</label>
      <div className="row">
        {Object.entries(TOOLS).map(([key, label]) => (
          <label key={key} className="chip" style={{ margin: 0, cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={draft.tools.includes(key)}
              onChange={e =>
                set("tools", e.target.checked ? [...draft.tools, key] : draft.tools.filter(t => t !== key))
              }
            />{" "}
            {label}
          </label>
        ))}
      </div>

      <label className="row" style={{ marginTop: 12 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={draft.sensitive} onChange={e => set("sensitive", e.target.checked)} />
        بيشتغل على بيانات حساسة (عملاء أو فلوس)
      </label>

      {warnings.map(w => (
        <p key={w} className="chip warn">
          {w}
        </p>
      ))}
      {error && <p className="error">{error}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" type="submit" disabled={busy}>
          حفظ
        </button>
        <button type="button" onClick={onDone}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

function ModelSelect({
  label,
  value,
  models,
  onChange,
}: {
  label: string;
  value: string;
  models: ModelInfo[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} dir="ltr">
        {!models.some(m => m.key === value) && <option value={value}>{value || "—"}</option>}
        {models.map(m => (
          <option key={m.key} value={m.key}>
            {m.key} ({m.rpd}/يوم)
          </option>
        ))}
      </select>
    </div>
  );
}
