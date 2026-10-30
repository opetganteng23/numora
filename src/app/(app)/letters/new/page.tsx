"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface LType {
  _id: string;
  name: string;
  code: string;
  formatPattern: string;
  active: boolean;
}
interface UnitItem {
  _id: string;
  name: string;
  code: string;
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

export default function NewLetterPage() {
  const [types, setTypes] = useState<LType[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ items: LType[] }>("/api/letter-types"),
      api<{ items: UnitItem[] }>("/api/units"),
      api<{ items: string[] }>("/api/letters/categories"),
    ])
      .then(([t, u, c]) => {
        setTypes(t.items.filter((x) => x.active));
        setUnits(u.items);
        setCategories(c.items);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setReady(true));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/letters", {
        json: {
          letterTypeId: f.get("letterTypeId"),
          unitId: f.get("unitId") || undefined,
          category: f.get("category") || undefined,
          subject: f.get("subject"),
          recipient: f.get("recipient"),
          letterDate: f.get("letterDate"),
        },
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 22 }}>Pengajuan terkirim</h1>
        <p className="muted">Nomor akan terbit setelah approver menyetujui. Anda akan mendapat email saat ada keputusan.</p>
        <div className="row-gap" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setDone(false)}>
            Ajukan lagi
          </button>
          <Link className="btn btn-ghost" href="/letters">
            Lihat registri
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ajukan Nomor</h1>
          <p className="muted">Isi data surat. Nomor belum dipakai sampai pengajuan disetujui.</p>
        </div>
      </div>
      <form className="card form-grid" onSubmit={onSubmit}>
        <div>
          <label htmlFor="letterTypeId">Jenis surat</label>
          <select id="letterTypeId" name="letterTypeId" required disabled={!ready}>
            {types.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name} ({t.formatPattern})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category">Kategori</label>
          <input id="category" name="category" list="cats" maxLength={60} placeholder="Surat Tugas, Surat Keluar (EXT), dan seterusnya" />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        {units.length > 0 && (
          <div>
            <label htmlFor="unitId">Unit kerja (opsional)</label>
            <select id="unitId" name="unitId" defaultValue="">
              <option value="">Unit saya</option>
              {units.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="letterDate">Tanggal surat</label>
          <input id="letterDate" name="letterDate" type="date" defaultValue={today()} required />
        </div>
        <div className="span2">
          <label htmlFor="subject">Perihal / kegiatan</label>
          <input id="subject" name="subject" maxLength={300} required />
        </div>
        <div className="span2">
          <label htmlFor="recipient">Ditujukan kepada</label>
          <input id="recipient" name="recipient" maxLength={300} required />
        </div>
        <div className="span2">
          {error && <p className="flash bad">{error}</p>}
          <button type="submit" disabled={busy || !ready || types.length === 0}>
            {busy ? "Mengirim..." : "Kirim pengajuan"}
          </button>
          {ready && types.length === 0 && <p className="muted small">Belum ada jenis surat aktif. Hubungi admin instansi.</p>}
        </div>
      </form>
    </>
  );
}
