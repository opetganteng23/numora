"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";

export default function LoginForm({ registrationOpen }: { registrationOpen: boolean }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Gagal masuk");
    }
  }

  return (
    <AuthShell title="Masuk ke NUMORA" subtitle="Numbering, Simplified.">
      <form className="card" onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <p style={{ textAlign: "right", margin: "8px 0 0", fontSize: 14 }}>
          <Link href="/forgot-password">Lupa password?</Link>
        </p>
        <button type="submit" disabled={loading}>
          {loading ? "Memproses..." : "Masuk"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      {registrationOpen && (
        <p className="muted" style={{ fontSize: 14, marginTop: 20 }}>
          Instansi Anda belum terdaftar? <Link href="/register">Daftar instansi</Link>
        </p>
      )}
    </AuthShell>
  );
}
