"use client";

import { useState } from "react";

/** Hash dihitung di browser. Berkas tidak dikirim ke server. */
export function HashChecker({ expected }: { expected: string }) {
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    setRes(hex === expected ? { ok: true, text: "Berkas cocok dengan dokumen final yang terdaftar." } : { ok: false, text: "Berkas TIDAK cocok dengan dokumen final yang terdaftar." });
  }

  return (
    <div style={{ marginTop: 14 }}>
      <label htmlFor="chk">Cocokkan berkas Anda (tidak diunggah, dihitung di perangkat ini)</label>
      <input id="chk" type="file" onChange={onFile} />
      {res && <p className={`flash ${res.ok ? "ok" : "bad"}`}>{res.text}</p>}
    </div>
  );
}
