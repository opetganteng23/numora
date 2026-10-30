"use client";

import { useEffect, useState } from "react";
import { ACTION_LABEL, api, fmtDateTime } from "@/lib/client";

interface Entry {
  _id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}


export default function AuditPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const limit = 30;

  useEffect(() => {
    api<{ items: { _id: string; name: string }[] }>("/api/users")
      .then((d) => setNames(Object.fromEntries(d.items.map((u) => [u._id, u.name]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (action) p.set("action", action);
    if (actorId) p.set("actorId", actorId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    api<{ items: Entry[]; total: number }>(`/api/audit?${p}`)
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [page, action, actorId, from, to]);

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
        <div className="filters">
          <select value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} aria-label="Aksi">
            <option value="">Semua aksi</option>
            {Object.entries(ACTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={actorId} onChange={(e) => { setPage(1); setActorId(e.target.value); }} aria-label="Pelaku">
            <option value="">Semua pelaku</option>
            {Object.entries(names).map(([id, n]) => (
              <option key={id} value={id}>{n}</option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} aria-label="Dari tanggal" style={{ flex: "0 1 160px" }} />
          <input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} aria-label="Sampai tanggal" style={{ flex: "0 1 160px" }} />
        </div>
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
