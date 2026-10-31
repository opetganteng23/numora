"use client";

import { useRef, useState } from "react";
import { formatNumber, getDateParts, PATTERN_TOKENS } from "@/lib/numbering";

const TOKEN_HINT: Record<string, string> = {
  urut: "nomor urut",
  jenis: "kode jenis",
  unit: "kode unit",
  bulan: "bulan 2 digit",
  bulan_romawi: "bulan romawi",
  tahun: "tahun",
};

/** Kolom format nomor dengan tombol token dan pratinjau langsung. Tetap memakai name="formatPattern" agar kompatibel dengan FormData. */
export function PatternDesigner({ id, defaultValue, code = "KODE", padding = 3 }: { id: string; defaultValue: string; code?: string; padding?: number }) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);

  let preview = "";
  let error = "";
  try {
    preview = formatNumber(value, { seq: 7, padding, typeCode: code, unitCode: "UNIT", parts: getDateParts(new Date(), "Asia/Jakarta") });
  } catch (e) {
    error = (e as Error).message;
  }

  function insert(token: string) {
    const el = ref.current;
    const text = `{${token}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  return (
    <>
      <input id={id} ref={ref} name="formatPattern" value={value} onChange={(e) => setValue(e.target.value)} required />
      <div className="chips" style={{ marginTop: 6 }}>
        {PATTERN_TOKENS.map((t) => (
          <button key={t} type="button" className="btn-sm btn-ghost" title={TOKEN_HINT[t]} onClick={() => insert(t)}>
            {`{${t}}`}
          </button>
        ))}
      </div>
      <p className="small" style={{ margin: "6px 0 0" }}>
        Pratinjau: {error ? <span className="bad-t">{error}</span> : <b className="mono">{preview}</b>}
        <span className="muted"> (contoh urutan 7, kode unit UNIT)</span>
      </p>
    </>
  );
}
