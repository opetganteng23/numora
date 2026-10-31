import ExcelJS from "exceljs";
import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { fmtDate } from "@/lib/client";
import { tablePdf } from "@/lib/pdf-table";
import { listLetters } from "@/services/letters";

const q = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  category: z.string().trim().max(60).optional(),
  q: z.string().trim().max(100).optional(),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
});

const HEAD = ["Nomor", "Jenis", "Kategori", "Perihal", "Tujuan", "Pemohon", "Tanggal", "Status"];

/** Sel CSV yang diawali = + - @ diberi tanda kutip agar tidak dieksekusi sebagai rumus di Excel. */
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const GET = handle(async (req) => {
  const ctx = await requireTenantUser();
  const { format, ...f } = q.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows: string[][] = [];
  for (let page = 1; page <= 200; page++) {
    const { items } = await listLetters(ctx, { ...f, page, limit: 500 });
    for (const l of items) {
      rows.push([l.number?.full ?? "", l.typeName, l.category ?? "", l.subject, l.recipient, l.requesterName, fmtDate(l.letterDate), l.status]);
    }
    if (items.length < 500) break;
  }

  const headers = { "Cache-Control": "private, no-store" };
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Registri Surat");
    ws.addRow(HEAD).font = { bold: true };
    // Teks diberikan sebagai string biasa sehingga tidak pernah dibaca sebagai rumus
    for (const r of rows) ws.addRow(r);
    ws.columns = [26, 22, 22, 50, 36, 24, 14, 12].map((width) => ({ width }));
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return new Response(new Uint8Array(buf), {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="registri-surat.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const filters = [f.status && `status ${f.status}`, f.category && `kategori ${f.category}`, f.q && `cari "${f.q}"`].filter(Boolean).join(", ");
    const pdf = await tablePdf(
      "Registri Nomor Surat",
      `${rows.length} surat${filters ? ` | filter: ${filters}` : ""}`,
      [{ title: "Nomor", width: 22 }, { title: "Jenis", width: 14 }, { title: "Kategori", width: 14 }, { title: "Perihal", width: 30 }, { title: "Tujuan", width: 20 }, { title: "Tanggal", width: 9 }, { title: "Status", width: 8 }],
      rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[6], r[7]]),
    );
    return new Response(new Uint8Array(pdf), {
      headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="registri-surat.pdf"` },
    });
  }

  const lines = [HEAD, ...rows].map((r) => r.map(cell).join(","));
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="registri-surat.csv"` },
  });
});
