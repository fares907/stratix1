"use client";

import type { ReactNode } from "react";

// أيقونات بسيطة (stroke) بنفس روح أيقونات الموقع
const PATHS: Record<string, string> = {
  room: "M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12Z",
  ideas: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z",
  reports: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  approvals: "M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  leads: "M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12ZM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  team: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  usage: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  logout: "M15 3h4v18h-4M10 17l5-5-5-5M15 12H3",
  stop: "M7 7h10v10H7z",
  play: "M8 5l11 7-11 7z",
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

const DEP_VAR: Record<string, string> = {
  management: "var(--dep-management)",
  sales: "var(--dep-sales)",
  operations: "var(--dep-operations)",
  site: "var(--dep-site)",
  dev: "var(--dep-dev)",
};

export function Avatar({ name, department, size }: { name: string; department?: string; size?: "sm" | "lg" }) {
  const letter = (name || "؟").trim().charAt(0);
  return (
    <span className={`avatar ${size ?? ""}`} style={{ ["--dep" as string]: DEP_VAR[department ?? ""] ?? "var(--signal)" }}>
      {letter}
    </span>
  );
}

export function Person({ name, title, department, size }: { name: string; title?: string; department?: string; size?: "sm" | "lg" }) {
  return (
    <span className="person">
      <Avatar name={name} department={department} size={size} />
      <span style={{ minWidth: 0 }}>
        <span className="person-name" style={{ display: "block" }}>{name}</span>
        {title && <span className="person-title" style={{ display: "block" }}>{title}</span>}
      </span>
    </span>
  );
}

export function PageHead({ eyebrow, title, subtitle, actions }: {
  eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function Empty({ icon = "✦", children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div>{children}</div>
    </div>
  );
}
