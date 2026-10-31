"use client";

import { useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { LogoutButton } from "@/components/LogoutButton";
import { api, fmtDate, fmtDateTime, ROLE_LABEL } from "@/lib/client";

interface Stats {
  totals: { tenants: number; activeTenants: number; users: number; letters: number; documents: number; documentBytes: number; mfaOn: number; mfaTotal: number };
  status: Record<string, number>;
  roles: Record<string, number>;
  days: { date: string; n: number }[];
  perTenant: { id: string; name: string; slug: string; status: string; users: number; activeUsers: number; letters: number; pending: number; approved: number; lastLogin: string | null; lastLetter: string | null }[];
}
interface TUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mfaEnabled?: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
}

type Tab = "ringkasan" | "instansi" | "baru";

/** Super Admin: analitik lintas instansi dan pengelolaan instansi serta penggunanya. Tidak menampilkan isi surat. */
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [stats, setStats] = useState<Stats | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [users, setUsers] = useState<TUser[]>([]);

  const load = useCallback(() => {
    api<Stats>("/api/admin/stats").then(setStats).catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, []);
  useEffect(load, [load]);

  const loadUsers = useCallback((id: string) => {
    api<{ items: TUser[] }>(`/api/admin/tenants/${id}/users`).then((d) => setUsers(d.items)).catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, []);

  async function run(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      load();
      after?.();
      return true;
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const toggleTenant = (t: Stats["perTenant"][number]) => {
    const next = t.status === "active" ? "suspended" : "active";
    if (next === "suspended" && !window.confirm(`Tangguhkan ${t.name}? Semua penggunanya tidak bisa masuk sampai diaktifkan lagi.`)) return;
    return run(() => api(`/api/admin/tenants/${t.id}`, { method: "PATCH", json: { status: next } }), next === "suspended" ? "Instansi ditangguhkan." : "Instansi diaktifkan kembali.");
  };
  const rename = (t: Stats["perTenant"][number]) => {
    const name = window.prompt("Nama instansi baru", t.name);
    if (name && name.trim() !== t.name) return run(() => api(`/api/admin/tenants/${t.id}`, { method: "PATCH", json: { name } }), "Nama instansi diubah.");
  };
  const remove = (t: Stats["perTenant"][number]) => {
    if (!window.confirm(`Hapus permanen ${t.name}? Ini tidak bisa dibatalkan. Hanya bisa untuk instansi yang belum punya surat.`)) return;
    return run(() => api(`/api/admin/tenants/${t.id}`, { method: "DELETE" }), "Instansi dihapus.", () => setOpen(null));
  };
  const patchUser = (u: TUser, body: object, ok: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    return run(() => api(`/api/admin/users/${u._id}`, { method: "PATCH", json: body }), ok, () => open && loadUsers(open));
  };

  const t = stats?.totals;
  const maxDay = Math.max(1, ...(stats?.days.map((d) => d.n) ?? [1]));

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
      <main style={{ maxWidth: 1100 }}>
        <h1>Super Admin</h1>
        <p className="muted">Analitik dan pengelolaan instansi. Isi surat tidak pernah ditampilkan di sini, hanya angka agregat.</p>
        <div className="row-gap" style={{ margin: "14px 0" }}>
          {([["ringkasan", "Ringkasan"], ["instansi", "Instansi dan pengguna"], ["baru", "Instansi baru"]] as [Tab, string][]).map(([k, l]) => (
            <button key={k} className={`btn-sm ${tab === k ? "" : "btn-ghost"}`} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
        {msg && <p className={`flash ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}

        {tab === "ringkasan" && stats && t && (
          <>
            <div className="grid4">
              <div className="card stat-card"><span className="muted">Instansi aktif</span><b>{t.activeTenants} / {t.tenants}</b></div>
              <div className="card stat-card"><span className="muted">Pengguna</span><b>{t.users}</b></div>
              <div className="card stat-card"><span className="muted">Total surat</span><b>{t.letters}</b></div>
              <div className="card stat-card"><span className="muted">Dokumen tersimpan</span><b>{t.documents}</b><span className="muted small">{(t.documentBytes / 1024 / 1024).toFixed(1)} MB</span></div>
            </div>
            <div className="grid4" style={{ marginTop: 16 }}>
              <div className="card stat-card"><span className="muted">Nomor terbit</span><b>{stats.status.approved ?? 0}</b></div>
              <div className="card stat-card"><span className="muted">Menunggu persetujuan</span><b className={stats.status.pending ? "warn" : ""}>{stats.status.pending ?? 0}</b></div>
              <div className="card stat-card"><span className="muted">Ditolak / dibatalkan</span><b>{(stats.status.rejected ?? 0) + (stats.status.cancelled ?? 0)}</b></div>
              <div className="card stat-card"><span className="muted">Pengguna dengan MFA</span><b>{t.mfaTotal ? Math.round((t.mfaOn / t.mfaTotal) * 100) : 0}%</b><span className="muted small">{t.mfaOn} dari {t.mfaTotal} akun aktif</span></div>
            </div>
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Surat diajukan, 30 hari terakhir</h3>
              <div className="bars" style={{ gridTemplateColumns: "repeat(30, 1fr)", gap: 3 }}>
                {stats.days.map((d, i) => (
                  <div key={d.date} className="bar-col" title={`${d.date}: ${d.n}`}>
                    <span className="bar-n">{d.n || ""}</span>
                    <div className="bar" style={{ height: `${(d.n / maxDay) * 100}%` }} />
                    <span className="bar-l">{i % 5 === 0 ? d.date.slice(8) : ""}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Peran pengguna</h3>
              <p className="small">
                {Object.entries(stats.roles).map(([r, n]) => `${ROLE_LABEL[r] ?? r}: ${n}`).join("  |  ") || "-"}
              </p>
            </div>
          </>
        )}

        {tab === "instansi" && stats && (
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Instansi</th><th>Status</th><th>Pengguna</th><th>Surat</th><th>Menunggu</th><th>Aktivitas terakhir</th><th></th></tr>
                </thead>
                <tbody>
                  {stats.perTenant.map((p) => (
                    <FragmentRow key={p.id}>
                      <tr>
                        <td>{p.name}<div className="muted small mono">{p.slug}</div></td>
                        <td>{p.status === "active" ? "Aktif" : "Ditangguhkan"}</td>
                        <td>{p.activeUsers} / {p.users}</td>
                        <td>{p.letters}</td>
                        <td>{p.pending}</td>
                        <td className="small">{p.lastLetter ? fmtDate(p.lastLetter) : "-"}</td>
                        <td className="actions">
                          <button className="btn-sm btn-ghost" onClick={() => { if (open === p.id) setOpen(null); else { setOpen(p.id); loadUsers(p.id); } }}>
                            {open === p.id ? "Tutup" : "Pengguna"}
                          </button>
                          <button className="btn-sm btn-ghost" disabled={busy} onClick={() => rename(p)}>Ubah nama</button>
                          <button className="btn-sm btn-ghost" disabled={busy} onClick={() => toggleTenant(p)}>{p.status === "active" ? "Tangguhkan" : "Aktifkan"}</button>
                          {p.letters === 0 && <button className="btn-sm btn-ghost" disabled={busy} onClick={() => remove(p)}>Hapus</button>}
                        </td>
                      </tr>
                      {open === p.id && (
                        <tr>
                          <td colSpan={7}>
                            <table className="tbl">
                              <thead><tr><th>Nama</th><th>Peran</th><th>Status</th><th>MFA</th><th>Login terakhir</th><th></th></tr></thead>
                              <tbody>
                                {users.map((u) => (
                                  <tr key={u._id}>
                                    <td>{u.name}<div className="muted small">{u.email}</div></td>
                                    <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                                    <td>{u.status === "active" ? "Aktif" : "Nonaktif"}{u.lockedUntil && new Date(u.lockedUntil) > new Date() ? " (terkunci)" : ""}</td>
                                    <td>{u.mfaEnabled ? "Aktif" : "-"}</td>
                                    <td className="small">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "-"}</td>
                                    <td className="actions">
                                      <button className="btn-sm btn-ghost" disabled={busy} onClick={() => patchUser(u, { status: u.status === "active" ? "disabled" : "active" }, u.status === "active" ? "Akun dinonaktifkan." : "Akun diaktifkan.")}>
                                        {u.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                                      </button>
                                      <button className="btn-sm btn-ghost" disabled={busy} onClick={() => patchUser(u, { unlock: true }, "Kunci login dibuka.")}>Buka kunci</button>
                                      {u.mfaEnabled && (
                                        <button className="btn-sm btn-ghost" disabled={busy} onClick={() => patchUser(u, { resetMfa: true }, "MFA direset.", `Reset MFA ${u.name}? Pastikan permintaan ini benar-benar dari pemilik akun.`)}>Reset MFA</button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <form
                              className="row-gap"
                              style={{ marginTop: 10 }}
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                const f = new FormData(form);
                                if (await run(() => api(`/api/admin/tenants/${p.id}/users`, { json: { name: f.get("name"), email: f.get("email") } }), "Undangan admin dikirim.")) form.reset();
                              }}
                            >
                              <input name="name" placeholder="Nama admin baru" required minLength={2} />
                              <input name="email" type="email" placeholder="Email" required />
                              <button className="btn-sm" disabled={busy}>Undang admin instansi</button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">Instansi yang sudah punya surat tidak bisa dihapus karena nomor adalah catatan resmi. Gunakan Tangguhkan.</p>
          </div>
        )}

        {tab === "baru" && (
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              const ok = await run(
                () => api("/api/admin/tenants", { json: { name: f.get("name"), slug: f.get("slug"), adminName: f.get("adminName"), adminEmail: f.get("adminEmail") } }),
                "Instansi dibuat dan undangan dikirim ke admin pertamanya.",
              );
              if (ok) form.reset();
            }}
          >
            <h3>Instansi baru</h3>
            <div className="form-grid">
              <div><label htmlFor="n">Nama instansi</label><input id="n" name="name" required minLength={2} /></div>
              <div><label htmlFor="s">Slug (huruf kecil, angka, strip)</label><input id="s" name="slug" required pattern="[a-z0-9\-]{2,40}" /></div>
              <div><label htmlFor="an">Nama admin pertama</label><input id="an" name="adminName" required minLength={2} /></div>
              <div><label htmlFor="ae">Email admin pertama</label><input id="ae" name="adminEmail" type="email" required /></div>
            </div>
            <button type="submit" disabled={busy}>{busy ? "Memproses..." : "Buat instansi dan undang admin"}</button>
          </form>
        )}
      </main>
    </>
  );
}

/** Pembungkus agar dua baris tabel bisa dikelompokkan dalam satu key. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
