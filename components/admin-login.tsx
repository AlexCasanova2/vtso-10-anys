"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Brand } from "@/components/brand";

export function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await createClient().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    setLoading(false);
    if (authError) return setError("El correu electrònic o la contrasenya no són correctes");
    router.push("/admin"); router.refresh();
  }

  return <main className="login-shell"><section className="login-card card"><Brand /><div className="login-icon"><LockKeyhole /></div><p className="eyebrow">Accés restringit</p><h1 className="display">Equip de l&apos;esdeveniment</h1><form onSubmit={submit}><div className="field"><label htmlFor="email">Correu electrònic</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div><div className="field"><label htmlFor="password">Contrasenya</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>{error && <div className="error">{error}</div>}<button className="button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={17} />} Entrar</button></form></section></main>;
}
