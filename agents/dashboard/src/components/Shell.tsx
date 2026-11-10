"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { KillSwitch } from "./KillSwitch";
import { Icon } from "./ui";
import { supabase } from "@/lib/supabase";
import { useLive } from "@/lib/useLive";

const LINKS = [
  { href: "/", label: "غرفة الاجتماعات", icon: "room" },
  { href: "/chat", label: "كلّم الموظفين", icon: "chat" },
  { href: "/ideas", label: "الأفكار والقرارات", icon: "ideas" },
  { href: "/reports", label: "التقارير", icon: "reports" },
  { href: "/approvals", label: "الموافقات", icon: "approvals", badge: true },
  { href: "/mail", label: "البريد", icon: "mail" },
  { href: "/leads", label: "العملاء المحتملين", icon: "leads" },
  { href: "/team", label: "الموظفين", icon: "team" },
  { href: "/usage", label: "استهلاك الموديلات", icon: "usage" },
];

export function Brand({ sub = true }: { sub?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">S</span>
      <span>
        <span className="brand-name" style={{ display: "block" }}>STRATIX HQ</span>
        {sub && <span className="brand-sub">مقر قيادة فريق الـ AI</span>}
      </span>
    </div>
  );
}

function PendingBadge() {
  const { rows } = useLive<{ id: number }>("approvals", () =>
    supabase().from("approvals").select("id").eq("status", "pending"),
  );
  return rows.length ? <span className="nav-badge">{rows.length}</span> : null;
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/(.)\/$/, "$1");
  const router = useRouter();
  const onLogin = path.startsWith("/login");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");

  // اللوحة ملفات ثابتة، فالتأكد من تسجيل الدخول بيحصل هنا في المتصفح.
  // ده للراحة بس: من غير تسجيل دخول Supabase نفسه (RLS) مابيرجّعش أي بيانات.
  useEffect(() => {
    const db = supabase();
    db.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session));
      setEmail(data.session?.user.email ?? "");
    });
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
      setEmail(session?.user.email ?? "");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authed === false && !onLogin) router.replace("/login");
    if (authed === true && onLogin) router.replace("/");
  }, [authed, onLogin, router]);

  if (onLogin) return <>{children}</>;
  if (!authed) {
    return (
      <div className="login-wrap">
        <p className="muted">جاري التحميل…</p>
      </div>
    );
  }

  async function logout() {
    await supabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <nav className="nav">
          {LINKS.map(link => (
            <Link key={link.href} href={link.href} className={path === link.href ? "active" : ""}>
              <Icon name={link.icon} />
              <span>{link.label}</span>
              {link.badge && <PendingBadge />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <KillSwitch />
          <button className="ghost" onClick={logout}>
            <Icon name="logout" size={16} /> <span className="hide-mobile">خروج</span>
          </button>
          {email && <div className="sidebar-user">{email}</div>}
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
