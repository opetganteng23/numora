"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    setLoading(false);
    if (res.ok) setSent(true);
    else setError("Email tidak valid atau terjadi kesalahan. Coba lagi.");
  }

  return (
    <AuthShell title="Lupa password" subtitle="Kami kirim tautan atur ulang ke email Anda.">
      {sent ? (
        <div className="card">
          <p>Jika email terdaftar, tautan atur ulang password sudah dikirim. Periksa kotak masuk dan folder spam. Tautan berlaku 1 jam.</p>
        </div>
      ) : (
        <form className="card" onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
          <button type="submit" disabled={loading}>
            {loading ? "Memproses..." : "Kirim tautan"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
      <p className="muted" style={{ fontSize: 14, marginTop: 20 }}>
        <Link href="/login">Kembali ke halaman masuk</Link>
      </p>
    </AuthShell>
  );
}
