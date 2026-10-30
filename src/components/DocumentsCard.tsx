"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtDateTime } from "@/lib/client";

export interface DocItem {
  version: number;
  fileName: string;
  size: number;
  sha256: string;
  uploadedAt: string;
  uploaderName: string;
}

/** Dokumen final surat: daftar versi, unduh, dan unggah versi baru. */
export function DocumentsCard({ letterId, docs, canUpload }: { letterId: string; docs: DocItem[]; canUpload: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/letters/${letterId}/documents`, { method: "POST", body: new FormData(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Gagal mengunggah");
      setMsg({ ok: true, text: `Versi ${d.version} tersimpan.` });
      form.reset();
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3>Dokumen final</h3>
      {docs.length === 0 ? (
        <p className="muted">Belum ada dokumen yang diunggah.</p>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Versi</th>
                <th>Berkas</th>
                <th>Ukuran</th>
                <th>Diunggah</th>
                <th>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {[...docs].reverse().map((d) => (
                <tr key={d.version}>
                  <td>v{d.version}</td>
                  <td>
                    <a href={`/api/letters/${letterId}/documents/${d.version}`}>{d.fileName}</a>
                  </td>
                  <td>{(d.size / 1024).toFixed(0)} KB</td>
                  <td>
                    {d.uploaderName}
                    <div className="muted small">{fmtDateTime(d.uploadedAt)}</div>
                  </td>
                  <td className="mono small" title={d.sha256}>
                    {d.sha256.slice(0, 16)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {msg && <p className={`flash ${msg.ok ? "ok" : "bad"}`}>{msg.text}</p>}
      {canUpload && (
        <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
          <label htmlFor="file">{docs.length ? "Unggah versi baru" : "Unggah dokumen"} (PDF, DOCX, XLSX, PNG, JPG, maksimal 10 MB)</label>
          <input id="file" name="file" type="file" required accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" />
          <button type="submit" className="btn-sm" disabled={busy} style={{ marginTop: 10 }}>
            {busy ? "Mengunggah..." : "Unggah"}
          </button>
        </form>
      )}
    </div>
  );
}
