"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Brand } from "@/components/Shell";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      setError("الإيميل أو الباسورد غلط");
      return;
    }
    router.replace("/");
  }

  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <Brand />
        <h1 style={{ fontSize: "1.35rem" }}>أهلًا يا ريس 👋</h1>
        <p className="muted" style={{ marginTop: 4 }}>ادخل عشان تشوف الفريق بيعمل إيه النهارده.</p>
        <form onSubmit={submit}>
          <label htmlFor="email">الإيميل</label>
          <input id="email" name="email" type="email" dir="ltr" autoComplete="username" required />
          <label htmlFor="password">الباسورد</label>
          <input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required />
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy} type="submit" style={{ width: "100%", marginTop: 18, padding: "11px 14px" }}>
            {busy ? "جاري الدخول…" : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
