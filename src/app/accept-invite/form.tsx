"use client";

import { useState } from "react";

export default function AcceptForm({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== form.get("confirm")) return setError("Konfirmasi password tidak sama");

    setLoading(true);
    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.issues?.fieldErrors?.password?.[0] ?? data.error ?? "Gagal mengaktifkan akun");
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <label htmlFor="password">Password baru (minimal 10 karakter)</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      <label htmlFor="confirm">Ulangi password</label>
      <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      <button type="submit" disabled={loading}>
        {loading ? "Memproses..." : "Aktifkan akun"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
