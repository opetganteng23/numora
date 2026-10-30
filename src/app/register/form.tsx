"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirm")) return setError("Konfirmasi password tidak sama");

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantName: form.get("tenantName"),
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.issues?.fieldErrors?.password?.[0] ?? data.error ?? "Gagal mendaftar");
    }
  }

  return (
    <AuthShell title="Daftarkan instansi" subtitle="Anda akan menjadi admin pertama instansi.">
      <form className="card" onSubmit={onSubmit}>
        <label htmlFor="tenantName">Nama instansi</label>
        <input id="tenantName" name="tenantName" required minLength={2} maxLength={120} />
        <label htmlFor="name">Nama Anda</label>
        <input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} />
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Password (minimal 10 karakter)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <label htmlFor="confirm">Ulangi password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        <button type="submit" disabled={loading}>
          {loading ? "Memproses..." : "Daftar"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      <p className="muted" style={{ fontSize: 14, marginTop: 20 }}>
        Sudah punya akun? <Link href="/login">Masuk</Link>
      </p>
    </AuthShell>
  );
}
