"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { KillSwitch } from "./KillSwitch";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "غرفة الاجتماعات" },
  { href: "/chat", label: "كلّم الموظفين" },
  { href: "/ideas", label: "الأفكار والقرارات" },
  { href: "/reports", label: "التقارير" },
  { href: "/approvals", label: "الموافقات" },
  { href: "/mail", label: "البريد" },
  { href: "/leads", label: "العملاء المحتملين" },
  { href: "/team", label: "الموظفين" },
  { href: "/usage", label: "استهلاك الموديلات" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/(.)\/$/, "$1");
  const router = useRouter();
  const onLogin = path.startsWith("/login");
  const [authed, setAuthed] = useState<boolean | null>(null);

  // اللوحة ملفات ثابتة، فالتأكد من تسجيل الدخول بيحصل هنا في المتصفح.
  // ده للراحة بس: من غير تسجيل دخول Supabase نفسه (RLS) مابيرجّعش أي بيانات.
  useEffect(() => {
    const db = supabase();
    db.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => setAuthed(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authed === false && !onLogin) router.replace("/login");
    if (authed === true && onLogin) router.replace("/");
  }, [authed, onLogin, router]);

  if (onLogin) {
    return <main className="shell">{children}</main>;
  }
  if (!authed) {
    return <main className="shell"><p className="muted">جاري التحميل…</p></main>;
  }

  async function logout() {
    await supabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">STRATIX HQ</span>
        <nav>
          {LINKS.map(link => (
            <Link key={link.href} href={link.href} className={path === link.href ? "active" : ""}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="row">
          <KillSwitch />
          <button onClick={logout}>خروج</button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
