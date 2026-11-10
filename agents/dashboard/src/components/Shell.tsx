"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { KillSwitch } from "./KillSwitch";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "غرفة الاجتماعات" },
  { href: "/team", label: "الموظفين" },
  { href: "/approvals", label: "الموافقات" },
  { href: "/leads", label: "العملاء المحتملين" },
  { href: "/usage", label: "استهلاك الموديلات" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  if (path.startsWith("/login")) {
    return <main className="shell">{children}</main>;
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
