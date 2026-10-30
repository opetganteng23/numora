"use client";

import { useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";

interface Entry {
  _id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  "letter.create": "Mengajukan nomor",
  "letter.approve": "Menyetujui dan menerbitkan nomor",
  "letter.reject": "Menolak pengajuan",
  "letter.cancel_request": "Mengajukan pembatalan",
  "letter.cancel": "Membatalkan nomor",
  "letters.import": "Impor data awal",
  "user.invite": "Mengundang pengguna",
  "user.accept_invite": "Mengaktifkan akun",
  "user.password_reset_request": "Meminta reset password",
  "user.password_reset": "Mengatur ulang password",
  "tenant.register": "Mendaftarkan instansi",
  "tenant.seed": "Membuat instansi",
  "unit.create": "Menambah unit",
  "lettertype.create": "Menambah jenis surat",
  "lettertype.update": "Mengubah jenis surat",
};

export default function AuditPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 30;

  useEffect(() => {
    api<{ items: { _id: string; name: string }[] }>("/api/users")
      .then((d) => setNames(Object.fromEntries(d.items.map((u) => [u._id, u.name]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    api<{ items: Entry[]; total: number }>(`/api/audit?page=${page}&limit=${limit}`)
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [page]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const detail = (m?: Record<string, unknown>) =>
    m
      ? Object.entries(m)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join(" | ")
      : "";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Jejak Audit</h1>
          <p className="muted">Catatan semua aksi penting di instansi Anda, terbaru di atas.</p>
        </div>
      </div>
      <div className="card">
        {error && <p className="flash bad">{error}</p>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pelaku</th>
                <th>Aksi</th>
                <th>Rincian</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="muted center">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((a) => (
                  <tr key={a._id}>
                    <td className="nowrap">{fmtDateTime(a.createdAt)}</td>
                    <td>{(a.actorId && names[a.actorId]) || "-"}</td>
                    <td>{ACTION_LABEL[a.action] ?? a.action}</td>
                    <td className="small muted">{detail(a.meta)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="row-between pager">
          <span className="muted small">{total} catatan</span>
          <div className="row-gap">
            <button className="btn-sm btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Sebelumnya
            </button>
            <span className="small">
              {page} / {pages}
            </span>
            <button className="btn-sm btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
