import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { fmtDate } from "@/lib/client";
import { listLetters } from "@/services/letters";

const q = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  category: z.string().trim().max(60).optional(),
  q: z.string().trim().max(100).optional(),
});

/** Sel yang diawali = + - @ diberi tanda kutip agar tidak dieksekusi sebagai rumus di Excel. */
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET = handle(async (req) => {
  const ctx = await requireTenantUser();
  const f = q.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows: string[] = [["Nomor", "Jenis", "Kategori", "Perihal", "Tujuan", "Pemohon", "Tanggal", "Status"].map(cell).join(",")];
  for (let page = 1; page <= 200; page++) {
    const { items } = await listLetters(ctx, { ...f, page, limit: 500 });
    for (const l of items) {
      rows.push([l.number?.full, l.typeName, l.category, l.subject, l.recipient, l.requesterName, fmtDate(l.letterDate), l.status].map(cell).join(","));
    }
    if (items.length < 500) break;
  }
  return new Response("﻿" + rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registri-surat.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
