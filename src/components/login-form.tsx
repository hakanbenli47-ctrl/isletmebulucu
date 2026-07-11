"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
      if (signInError) throw signInError;
      window.location.assign("/website");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Giriş yapılamadı.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="login-form">
      <label>E-posta<input name="email" type="email" autoComplete="email" required /></label>
      <label>Şifre<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full" disabled={loading} type="submit"><LogIn size={18} />{loading ? "Giriş yapılıyor…" : "Giriş Yap"}</button>
      <p className="login-note">Yeni kullanıcı kaydı kapalıdır. Hesap Supabase panelinden oluşturulur.</p>
    </form>
  );
}
