"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export default function ProfilePage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("newPassword") !== f.get("confirm")) return setMsg({ ok: false, text: "Konfirmasi password tidak sama" });
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/auth/change-password", { json: { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") } });
      setMsg({ ok: true, text: "Password berhasil diganti." });
      form.reset();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Profil dan Keamanan</h1>
          <p className="muted">Ganti password akun Anda.</p>
        </div>
      </div>
      <form className="card" style={{ maxWidth: 480 }} onSubmit={onSubmit}>
        <label htmlFor="cur">Password saat ini</label>
        <input id="cur" name="currentPassword" type="password" autoComplete="current-password" required />
        <label htmlFor="new">Password baru (minimal 10 karakter)</label>
        <input id="new" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
        <label htmlFor="conf">Ulangi password baru</label>
        <input id="conf" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        {msg && <p className={`flash ${msg.ok ? "ok" : "bad"}`} style={{ marginTop: 14 }}>{msg.text}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Menyimpan..." : "Simpan password"}
        </button>
      </form>
    </>
  );
}
