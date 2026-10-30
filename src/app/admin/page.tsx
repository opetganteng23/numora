"use client";

import { useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { LogoutButton } from "@/components/LogoutButton";
import { api, fmtDate } from "@/lib/client";

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
}

/** Halaman Super Admin: daftar instansi dan pembuatan instansi baru. Tidak menampilkan isi surat. */
export default function AdminPage() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ items: Tenant[] }>("/api/admin/tenants")
      .then((d) => setItems(d.items))
      .catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, []);
  useEffect(load, [load]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/admin/tenants", {
        json: { name: f.get("name"), slug: f.get("slug"), adminName: f.get("adminName"), adminEmail: f.get("adminEmail") },
      });
      setMsg({ ok: true, text: "Instansi dibuat dan undangan dikirim ke admin pertamanya." });
      form.reset();
      load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Brand />
          <nav>
            <span className="muted who">Super Admin</span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 900 }}>
        <h1>Kelola instansi</h1>
        <p className="muted">Super Admin hanya mengelola instansi, bukan isi surat.</p>
        {msg && <p className={`flash ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Instansi</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t._id}>
                    <td>{t.name}</td>
                    <td className="mono">{t.slug}</td>
                    <td>{t.status === "active" ? "Aktif" : "Ditangguhkan"}</td>
                    <td>{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <form className="card" style={{ marginTop: 18 }} onSubmit={onSubmit}>
          <h3>Instansi baru</h3>
          <div className="form-grid">
            <div>
              <label htmlFor="n">Nama instansi</label>
              <input id="n" name="name" required minLength={2} />
            </div>
            <div>
              <label htmlFor="s">Slug (huruf kecil, angka, strip)</label>
              <input id="s" name="slug" required pattern="[a-z0-9\-]{2,40}" />
            </div>
            <div>
              <label htmlFor="an">Nama admin pertama</label>
              <input id="an" name="adminName" required minLength={2} />
            </div>
            <div>
              <label htmlFor="ae">Email admin pertama</label>
              <input id="ae" name="adminEmail" type="email" required />
            </div>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "Memproses..." : "Buat instansi dan undang admin"}
          </button>
        </form>
      </main>
    </>
  );
}
