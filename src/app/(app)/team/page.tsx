"use client";

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

const RESET_LABEL: Record<string, string> = { yearly: "Tahunan", monthly: "Bulanan", never: "Tanpa reset" };

export default function TeamPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [types, setTypes] = useState<LType[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfApprove, setSelfApprove] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, un, t] = await Promise.all([
        api<{ items: U[] }>("/api/users"),
        api<{ items: Unit[] }>("/api/units"),
        api<{ items: LType[] }>("/api/letter-types"),
      ]);
      setUsers(u.items);
      setUnits(un.items);
      setTypes(t.items);
      const st = await api<{ settings: { allowSelfApproval: boolean } }>("/api/tenant/settings");
      setSelfApprove(st.settings.allowSelfApproval);
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
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const uName = (id: string) => users.find((u) => u._id === id)?.name ?? "-";

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
                <th>Terakhir masuk</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td>{units.find((x) => x._id === u.unitId)?.code ?? "-"}</td>
                  <td>{fmtDateTime(u.lastLoginAt)}</td>
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
            const form = e.currentTarget;
            run(
              () =>
                api("/api/users/invite", {
                  json: { email: f.get("email"), name: f.get("name"), role: f.get("role"), unitId: f.get("unitId") || undefined },
                }),
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
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t._id}>
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
            const approverIds = f.getAll("approverIds").map(String);
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
                    approverIds,
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
              <input id="tpat" name="formatPattern" defaultValue="{urut}/{jenis}/{bulan_romawi}/{tahun}" required />
              <p className="muted small">Token: {"{urut} {jenis} {unit} {bulan} {bulan_romawi} {tahun}"}. Reset tahunan wajib memuat {"{tahun}"}.</p>
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
    </>
  );
}
