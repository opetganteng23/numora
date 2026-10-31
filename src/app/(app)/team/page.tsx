"use client";

import { PatternDesigner } from "@/components/PatternDesigner";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime, ROLE_LABEL } from "@/lib/client";

interface U {
  _id: string;
  name: string;
  email: string;
  role: string;
  unitId: string | null;
  status: string;
  lastLoginAt: string | null;
}
interface Unit {
  _id: string;
  name: string;
  code: string;
}
interface LType {
  _id: string;
  name: string;
  code: string;
  formatPattern: string;
  padding: number;
  resetPolicy: string;
  perUnit: boolean;
  approverIds: string[];
  active: boolean;
}
interface Inv {
  _id: string;
  email: string;
  name: string;
  role: string;
  expiresAt: string;
}

const RESET_LABEL: Record<string, string> = { yearly: "Tahunan", monthly: "Bulanan", never: "Tanpa reset" };

export default function TeamPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [types, setTypes] = useState<LType[]>([]);
  const [invites, setInvites] = useState<Inv[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfApprove, setSelfApprove] = useState<boolean | null>(null);
  const [editUser, setEditUser] = useState<U | null>(null);
  const [editType, setEditType] = useState<LType | null>(null);
  const [me, setMe] = useState("");

  const load = useCallback(async () => {
    try {
      const [u, un, t, inv, st, who] = await Promise.all([
        api<{ items: U[] }>("/api/users"),
        api<{ items: Unit[] }>("/api/units"),
        api<{ items: LType[] }>("/api/letter-types"),
        api<{ items: Inv[] }>("/api/invitations"),
        api<{ settings: { allowSelfApproval: boolean } }>("/api/tenant/settings"),
        api<{ user: { userId: string } }>("/api/auth/me"),
      ]);
      setUsers(u.items);
      setUnits(un.items);
      setTypes(t.items);
      setInvites(inv.items);
      setSelfApprove(st.settings.allowSelfApproval);
      setMe(who.user.userId);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, okText: string, form?: HTMLFormElement) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      form?.reset();
      await load();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const uName = (id: string) => users.find((u) => u._id === id)?.name ?? "-";
  const unitCode = (id: string | null) => units.find((x) => x._id === id)?.code ?? "-";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pengaturan</h1>
          <p className="muted">Kelola pengguna, unit kerja, dan jenis surat instansi Anda.</p>
        </div>
      </div>
      {msg && <p className={`flash ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Kebijakan persetujuan</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={!!selfApprove}
            disabled={busy || selfApprove === null}
            onChange={(e) => run(() => api("/api/tenant/settings", { method: "PATCH", json: { allowSelfApproval: e.target.checked } }), "Kebijakan disimpan.")}
          />
          Izinkan pemohon menyetujui pengajuannya sendiri
        </label>
        <p className="muted small" style={{ margin: "6px 0 0" }}>
          Dianjurkan mati agar ada pemisahan tugas. Nyalakan hanya bila instansi Anda baru punya satu admin. Setiap perubahan tercatat di jejak audit.
        </p>
      </div>

      <div className="card">
        <h3>Pengguna</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Terakhir masuk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className={u.status === "disabled" ? "dim" : ""}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td>{unitCode(u.unitId)}</td>
                  <td>{u.status === "active" ? "Aktif" : "Nonaktif"}</td>
                  <td>{fmtDateTime(u.lastLoginAt)}</td>
                  <td className="actions">
                    <button className="btn-sm btn-ghost" onClick={() => setEditUser(u)}>
                      Ubah
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invites.length > 0 && (
          <>
            <h4>Undangan yang belum dipakai</h4>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Peran</th>
                    <th>Berlaku sampai</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i._id}>
                      <td>{i.name}</td>
                      <td>{i.email}</td>
                      <td>{ROLE_LABEL[i.role] ?? i.role}</td>
                      <td>{fmtDateTime(i.expiresAt)}</td>
                      <td className="actions">
                        <button
                          className="btn-sm btn-ghost"
                          disabled={busy}
                          onClick={() => run(() => api(`/api/invitations/${i._id}/resend`, { json: {} }), `Undangan dikirim ulang ke ${i.email}.`)}
                        >
                          Kirim ulang
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const form = e.currentTarget;
            run(
              () => api("/api/users/invite", { json: { email: f.get("email"), name: f.get("name"), role: f.get("role"), unitId: f.get("unitId") || undefined } }),
              "Undangan dikirim lewat email (berlaku 72 jam).",
              form,
            );
          }}
        >
          <h4>Undang pengguna</h4>
          <div className="form-grid">
            <div>
              <label htmlFor="iname">Nama</label>
              <input id="iname" name="name" required minLength={2} />
            </div>
            <div>
              <label htmlFor="iemail">Email</label>
              <input id="iemail" name="email" type="email" required />
            </div>
            <div>
              <label htmlFor="irole">Peran</label>
              <select id="irole" name="role" defaultValue="staff">
                <option value="staff">Staf</option>
                <option value="unit_admin">Admin Unit</option>
                <option value="auditor">Auditor</option>
                <option value="tenant_admin">Admin Instansi</option>
              </select>
            </div>
            <div>
              <label htmlFor="iunit">Unit kerja (wajib untuk Admin Unit)</label>
              <select id="iunit" name="unitId" defaultValue="">
                <option value="">Tanpa unit</option>
                {units.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={busy}>
            Kirim undangan
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Unit kerja</h3>
        {units.length === 0 ? (
          <p className="muted">Belum ada unit kerja. Unit bersifat opsional.</p>
        ) : (
          <div className="chips">
            {units.map((u) => (
              <span className="chip-s" key={u._id}>
                {u.name} <b>{u.code}</b>
              </span>
            ))}
          </div>
        )}
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => api("/api/units", { json: { name: f.get("name"), code: f.get("code") } }), "Unit ditambahkan.", e.currentTarget);
          }}
        >
          <div className="form-grid">
            <div>
              <label htmlFor="uname">Nama unit</label>
              <input id="uname" name="name" required minLength={2} />
            </div>
            <div>
              <label htmlFor="ucode">Kode (huruf besar, angka)</label>
              <input id="ucode" name="code" required maxLength={20} />
            </div>
          </div>
          <button type="submit" disabled={busy}>
            Tambah unit
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Jenis surat dan format nomor</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Format</th>
                <th>Reset</th>
                <th>Approver</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t._id} className={t.active ? "" : "dim"}>
                  <td>
                    {t.name} <span className="muted small">({t.code})</span>
                  </td>
                  <td className="mono">{t.formatPattern}</td>
                  <td>
                    {RESET_LABEL[t.resetPolicy]}
                    {t.perUnit ? ", per unit" : ""}
                  </td>
                  <td>{t.approverIds.map(uName).join(", ") || "Admin instansi"}</td>
                  <td>{t.active ? "Aktif" : "Nonaktif"}</td>
                  <td className="actions">
                    <button className="btn-sm btn-ghost" onClick={() => setEditType(t)}>
                      Ubah
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                api("/api/letter-types", {
                  json: {
                    name: f.get("name"),
                    code: f.get("code"),
                    formatPattern: f.get("formatPattern"),
                    padding: Number(f.get("padding")),
                    resetPolicy: f.get("resetPolicy"),
                    perUnit: f.get("perUnit") === "on",
                    approverIds: f.getAll("approverIds").map(String),
                  },
                }),
              "Jenis surat ditambahkan.",
              e.currentTarget,
            );
          }}
        >
          <h4>Tambah jenis surat</h4>
          <div className="form-grid">
            <div>
              <label htmlFor="tname">Nama</label>
              <input id="tname" name="name" required />
            </div>
            <div>
              <label htmlFor="tcode">Kode</label>
              <input id="tcode" name="code" required maxLength={20} />
            </div>
            <div className="span2">
              <label htmlFor="tpat">Format nomor</label>
              <PatternDesigner id="tpat" defaultValue="{urut}/{jenis}/{bulan_romawi}/{tahun}" />
              <p className="muted small">Reset tahunan wajib memuat {"{tahun}"}. Teks biasa seperti SDM4 boleh ditulis langsung.</p>
            </div>
            <div>
              <label htmlFor="tpad">Digit nomor urut</label>
              <input id="tpad" name="padding" type="number" min={1} max={8} defaultValue={3} />
            </div>
            <div>
              <label htmlFor="treset">Reset urutan</label>
              <select id="treset" name="resetPolicy" defaultValue="yearly">
                <option value="yearly">Tahunan</option>
                <option value="monthly">Bulanan</option>
                <option value="never">Tanpa reset</option>
              </select>
            </div>
            <div className="span2">
              <label>Approver (kosong berarti hanya admin instansi)</label>
              <div className="chips">
                {users
                  .filter((u) => u.status === "active" && u.role !== "auditor")
                  .map((u) => (
                    <label key={u._id} className="check">
                      <input type="checkbox" name="approverIds" value={u._id} /> {u.name}
                    </label>
                  ))}
              </div>
            </div>
            <div className="span2">
              <label className="check">
                <input type="checkbox" name="perUnit" /> Pisahkan urutan per unit (format wajib memuat {"{unit}"})
              </label>
            </div>
          </div>
          <button type="submit" disabled={busy}>
            Tambah jenis surat
          </button>
        </form>
      </div>

      {editUser && (
        <div className="overlay" onClick={() => !busy && setEditUser(null)}>
          <form
            className="dialog card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const self = editUser._id === me;
              const body: Record<string, unknown> = { name: f.get("name"), unitId: f.get("unitId") || null };
              if (!self) {
                body.role = f.get("role");
                body.status = f.get("status");
              }
              if (await run(() => api(`/api/users/${editUser._id}`, { method: "PATCH", json: body }), "Pengguna diperbarui.")) setEditUser(null);
            }}
          >
            <h3>Ubah pengguna</h3>
            <p className="muted small" style={{ margin: "0 0 6px" }}>{editUser.email}</p>
            <label htmlFor="en">Nama</label>
            <input id="en" name="name" defaultValue={editUser.name} required minLength={2} />
            {editUser._id !== me && (
              <>
                <label htmlFor="er">Peran</label>
                <select id="er" name="role" defaultValue={editUser.role}>
                  <option value="staff">Staf</option>
                  <option value="unit_admin">Admin Unit</option>
                  <option value="auditor">Auditor</option>
                  <option value="tenant_admin">Admin Instansi</option>
                </select>
                <label htmlFor="es">Status</label>
                <select id="es" name="status" defaultValue={editUser.status}>
                  <option value="active">Aktif</option>
                  <option value="disabled">Nonaktif (tidak bisa masuk)</option>
                </select>
              </>
            )}
            <label htmlFor="eu">Unit kerja</label>
            <select id="eu" name="unitId" defaultValue={editUser.unitId ?? ""}>
              <option value="">Tanpa unit</option>
              {units.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
            <div className="row-gap" style={{ marginTop: 16 }}>
              <button type="submit" className="btn-sm" disabled={busy}>
                Simpan
              </button>
              <button type="button" className="btn-sm btn-ghost" disabled={busy} onClick={() => setEditUser(null)}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {editType && (
        <div className="overlay" onClick={() => !busy && setEditType(null)}>
          <form
            className="dialog card"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const body = {
                name: f.get("name"),
                formatPattern: f.get("formatPattern"),
                padding: Number(f.get("padding")),
                approverIds: f.getAll("approverIds").map(String),
                active: f.get("active") === "on",
              };
              if (await run(() => api(`/api/letter-types/${editType._id}`, { method: "PATCH", json: body }), "Jenis surat diperbarui.")) setEditType(null);
            }}
          >
            <h3>Ubah jenis surat ({editType.code})</h3>
            <label htmlFor="etn">Nama</label>
            <input id="etn" name="name" defaultValue={editType.name} required minLength={2} />
            <label htmlFor="etp">Format nomor</label>
            <PatternDesigner id="etp" defaultValue={editType.formatPattern} code={editType.code} padding={editType.padding} />
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Mengubah format hanya berlaku untuk nomor berikutnya. Nomor yang sudah terbit tidak berubah. Aturan reset dan per unit terkunci bila sudah ada surat.
            </p>
            <label htmlFor="etd">Digit nomor urut</label>
            <input id="etd" name="padding" type="number" min={1} max={8} defaultValue={editType.padding} />
            <label>Approver (kosong berarti hanya admin instansi)</label>
            <div className="chips">
              {users
                .filter((u) => u.status === "active" && u.role !== "auditor")
                .map((u) => (
                  <label key={u._id} className="check">
                    <input type="checkbox" name="approverIds" value={u._id} defaultChecked={editType.approverIds.includes(u._id)} /> {u.name}
                  </label>
                ))}
            </div>
            <label className="check" style={{ marginTop: 12 }}>
              <input type="checkbox" name="active" defaultChecked={editType.active} /> Aktif (bisa dipilih saat mengajukan nomor)
            </label>
            <div className="row-gap" style={{ marginTop: 16 }}>
              <button type="submit" className="btn-sm" disabled={busy}>
                Simpan
              </button>
              <button type="button" className="btn-sm btn-ghost" disabled={busy} onClick={() => setEditType(null)}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
