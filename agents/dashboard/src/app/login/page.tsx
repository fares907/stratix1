"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      setError("الإيميل أو الباسورد غلط");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="panel" style={{ maxWidth: 380, margin: "10vh auto" }}>
      <h1>STRATIX HQ</h1>
      <form onSubmit={submit}>
        <label htmlFor="email">الإيميل</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">الباسورد</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {error && <p className="error">{error}</p>}
        <p>
          <button className="primary" disabled={busy} type="submit">
            دخول
          </button>
        </p>
      </form>
    </div>
  );
}
