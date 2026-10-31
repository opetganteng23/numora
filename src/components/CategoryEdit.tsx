"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

/** Ubah kategori surat (khusus admin instansi). Saran diambil dari kategori yang sudah dipakai. */
export function CategoryEdit({ letterId, current }: { letterId: string; current: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (editing) api<{ items: string[] }>("/api/letters/categories").then((d) => setOptions(d.items)).catch(() => undefined);
  }, [editing]);

  if (!editing)
    return (
      <>
        {current || "-"}{" "}
        <button type="button" className="btn-sm btn-ghost" onClick={() => setEditing(true)}>
          Ubah
        </button>
      </>
    );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(`/api/letters/${letterId}`, { method: "PATCH", json: { category: new FormData(e.currentTarget).get("category") } });
          setEditing(false);
          router.refresh();
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <input name="category" list={`cats-${letterId}`} defaultValue={current} maxLength={60} autoFocus />
      <datalist id={`cats-${letterId}`}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <button type="submit" className="btn-sm">Simpan</button>{" "}
      <button type="button" className="btn-sm btn-ghost" onClick={() => setEditing(false)}>Batal</button>
      {err && <span className="small bad-t"> {err}</span>}
    </form>
  );
}
