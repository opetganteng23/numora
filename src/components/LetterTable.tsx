"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, STATUS_LABEL } from "@/lib/client";

interface Letter {
  _id: string;
  number?: { full: string };
  subject: string;
  recipient: string;
  category?: string;
  requesterName: string;
  typeName: string;
  letterDate: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejectReason?: string;
  cancelReason?: string;
  cancelRequest?: { reason: string };
  can: { approve: boolean; requestCancel: boolean; cancel: boolean };
}

type ActionType = "reject" | "cancel-request" | "cancel";
const ACTION_LABEL: Record<ActionType, string> = {
  reject: "Tolak pengajuan",
  "cancel-request": "Ajukan pembatalan",
  cancel: "Batalkan nomor",
};

/** mode "approvals": hanya yang menunggu keputusan. mode "registry": semua surat dengan filter. */
export function LetterTable({ mode }: { mode: "registry" | "approvals" }) {
  const [items, setItems] = useState<Letter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(mode === "approvals" ? "pending" : "");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [panel, setPanel] = useState<{ id: string; type: ActionType } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) p.set("q", q);
      if (status) p.set("status", status);
      if (category) p.set("category", category);
      const data = await api<{ items: Letter[]; total: number }>(`/api/letters?${p}`);
      setItems(mode === "approvals" ? data.items.filter((l) => l.can.approve) : data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, q, status, category, mode]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    api<{ items: string[] }>("/api/letters/categories").then((d) => setCategories(d.items)).catch(() => undefined);
  }, []);

  async function approve(l: Letter) {
    setBusy(true);
    setFlash("");
    try {
      const d = await api<{ letter: { number: { full: string } } }>(`/api/letters/${l._id}/approve`, { json: {} });
      setFlash(`Disetujui. Nomor terbit: ${d.letter.number.full}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReason(e: React.FormEvent) {
    e.preventDefault();
    if (!panel) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/letters/${panel.id}/${panel.type}`, { json: { reason } });
      setFlash(`${ACTION_LABEL[panel.type]} berhasil.`);
      setPanel(null);
      setReason("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="card">
      <div className="filters">
        <input
          placeholder="Cari nomor, perihal, tujuan, kategori"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          aria-label="Cari"
        />
        {mode === "registry" && (
          <>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              aria-label="Status"
            >
              <option value="">Semua status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value);
              }}
              aria-label="Kategori"
            >
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {flash && <p className="flash ok">{flash}</p>}
      {error && <p className="flash bad">{error}</p>}

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Perihal</th>
              <th>Kategori</th>
              <th>Pemohon</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="muted center">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="muted center">
                  {mode === "approvals" ? "Tidak ada pengajuan yang menunggu keputusan Anda." : "Tidak ada surat yang cocok."}
                </td>
              </tr>
            )}
            {!loading &&
              items.map((l) => (
                <tr key={l._id}>
                  <td className="mono">{l.number?.full ?? <span className="muted">belum ada</span>}</td>
                  <td>
                    <Link href={`/letters/${l._id}`}>{l.subject}</Link>
                    <div className="muted small">Kepada: {l.recipient}</div>
                    {l.rejectReason && <div className="small bad-t">Ditolak: {l.rejectReason}</div>}
                    {l.cancelReason && <div className="small bad-t">Dibatalkan: {l.cancelReason}</div>}
                    {l.cancelRequest && l.status === "approved" && <div className="small warn-t">Pembatalan diajukan: {l.cancelRequest.reason}</div>}
                  </td>
                  <td>{l.category ?? "-"}</td>
                  <td>{l.requesterName}</td>
                  <td>{fmtDate(l.letterDate)}</td>
                  <td>
                    <span className={`st ${l.status}`}>{STATUS_LABEL[l.status]}</span>
                  </td>
                  <td className="actions">
                    {l.can.approve && (
                      <>
                        <button className="btn-sm" disabled={busy} onClick={() => approve(l)}>
                          Setujui
                        </button>
                        <button className="btn-sm btn-ghost" disabled={busy} onClick={() => setPanel({ id: l._id, type: "reject" })}>
                          Tolak
                        </button>
                      </>
                    )}
                    {l.can.cancel && (
                      <button className="btn-sm btn-ghost" disabled={busy} onClick={() => setPanel({ id: l._id, type: "cancel" })}>
                        Batalkan
                      </button>
                    )}
                    {!l.can.cancel && l.can.requestCancel && (
                      <button className="btn-sm btn-ghost" disabled={busy} onClick={() => setPanel({ id: l._id, type: "cancel-request" })}>
                        Ajukan batal
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="row-between pager">
        <span className="muted small">{total} surat</span>
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

      {panel && (
        <div className="overlay" onClick={() => !busy && setPanel(null)}>
          <form className="dialog card" onClick={(e) => e.stopPropagation()} onSubmit={submitReason}>
            <h3>{ACTION_LABEL[panel.type]}</h3>
            <label htmlFor="reason">Alasan (minimal 3 karakter)</label>
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={500} required autoFocus />
            <div className="row-gap" style={{ marginTop: 16 }}>
              <button type="submit" className="btn-sm" disabled={busy}>
                {busy ? "Memproses..." : "Konfirmasi"}
              </button>
              <button type="button" className="btn-sm btn-ghost" disabled={busy} onClick={() => setPanel(null)}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
