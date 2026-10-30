/**
 * Impor nomor surat dari spreadsheet lama (CSV) sebagai data awal NUMORA.
 *
 *   npx tsx scripts/import-sheet.ts data/nomor-surat.csv                       (dry run, tanpa database)
 *   npx tsx --env-file=.env scripts/import-sheet.ts data/nomor-surat.csv --tenant=ailo --apply
 *
 * Kolom CSV: No, Nama, Nomor Surat, Kegiatan, Tanggal, Pembuat, Persetujuan
 *
 * Aturan:
 * - Semua nomor di sheet dianggap SUDAH TERPAKAI (status approved), termasuk baris yang
 *   keterangannya kosong, karena nomornya sudah beredar dan tidak boleh dipakai ulang.
 * - Satu jenis surat ("Surat Resmi AILO") dengan satu urutan bersama; kolom Nama menjadi `category`.
 * - Counter diset ke nomor tertinggi sehingga nomor berikutnya = tertinggi + 1.
 * - Menolak berjalan bila jenis surat tsb sudah punya surat (aman dari impor ganda).
 */
import { readFileSync } from "node:fs";
import mongoose, { Types } from "mongoose";

const TYPE_CODE = "SDM4";
const TYPE_NAME = "Surat Resmi AILO";
const PATTERN = "{urut}/SDM4/AILO/{tahun}";
const YEAR = 2026;
const PERIOD = String(YEAR);

export interface Row {
  sheetNo: number | null;
  category: string;
  full: string;
  seq: number;
  subject: string;
  date: Date;
  creator: string;
  approval: string;
  notes: string[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^\^\s*/, "").trim();

/** m/d/yyyy -> 12:00 WIB, supaya tanggal tidak bergeser lintas zona waktu. */
function parseDate(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], 5, 0, 0));
}

export function parseSheet(text: string): Row[] {
  const rows = parseCsv(text).slice(1);
  const out: Row[] = [];
  let lastDate: Date | null = null;
  for (const r of rows) {
    const full = (r[2] ?? "").trim();
    const m = /^(\d+)\/SDM4\//.exec(full);
    if (!m) continue; // baris tanpa nomor
    const notes: string[] = [];
    const seq = Number(m[1]);

    let date = parseDate(r[4] ?? "");
    if (!date) {
      date = lastDate ?? new Date(Date.UTC(YEAR, 0, 1, 5));
      notes.push("tanggal tidak ada di sheet, diisi dari baris sebelumnya");
    } else lastDate = date;

    const subject = clean(r[3] ?? "");
    if (!subject) notes.push("keterangan kosong di sheet");
    const approval = (r[6] ?? "").trim();
    if (!approval) notes.push("kolom persetujuan kosong di sheet");
    if (!full.includes("/AILO/")) notes.push("awalan nomor asli bukan AILO");

    out.push({
      sheetNo: /^\d+$/.test((r[0] ?? "").trim()) ? Number(r[0]) : null,
      category: clean(r[1] ?? "") || "Belum dikategorikan",
      full,
      seq,
      subject: (subject || "(keterangan belum diisi)").slice(0, 300),
      date,
      creator: (r[5] ?? "").trim(),
      approval,
      notes,
    });
  }
  return out;
}

function report(rows: Row[]) {
  const seqs = rows.map((r) => r.seq);
  const max = Math.max(...seqs);
  const dup = seqs.filter((s, i) => seqs.indexOf(s) !== i);
  const full = rows.map((r) => r.full);
  const dupFull = full.filter((s, i) => full.indexOf(s) !== i);
  const cats: Record<string, number> = {};
  rows.forEach((r) => (cats[r.category] = (cats[r.category] ?? 0) + 1));
  const gaps: string[] = [];
  const sorted = [...seqs].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > 1) gaps.push(`${sorted[i - 1] + 1}-${sorted[i] - 1}`);
  }
  console.log(`Baris bernomor     : ${rows.length}`);
  console.log(`Nomor tertinggi    : ${max} (nomor berikutnya ${String(max + 1).padStart(3, "0")}/SDM4/AILO/${YEAR})`);
  console.log(`Urutan ganda       : ${dup.length ? dup.join(", ") : "tidak ada"}`);
  console.log(`Teks nomor ganda   : ${dupFull.length ? dupFull.join(", ") : "tidak ada"}`);
  console.log(`Loncatan urutan    : ${gaps.join(", ") || "tidak ada"}`);
  console.log(`Kategori           :`, cats);
  const flagged = rows.filter((r) => r.notes.length);
  console.log(`Baris dengan catatan: ${flagged.length}`);
  flagged.forEach((r) => console.log(`  ${r.full}  ${r.notes.join("; ")}`));
  return { max, dup, dupFull };
}

async function apply(rows: Row[], slug: string, max: number) {
  const { connectDB } = await import("../src/lib/db");
  const { AuditLog, Counter, Letter, LetterType, Tenant, User } = await import("../src/models");
  await connectDB();

  const tenant = await Tenant.findOne({ slug }).lean();
  if (!tenant) throw new Error(`Instansi dengan slug "${slug}" tidak ditemukan. Daftarkan dulu lewat /register.`);
  const admin = await User.findOne({ tenantId: tenant._id, role: "tenant_admin", status: "active" }).sort({ createdAt: 1 }).lean();
  if (!admin) throw new Error("Instansi belum punya tenant_admin aktif");

  await mongoose.connection.transaction(async (session) => {
    let type = await LetterType.findOne({ tenantId: tenant._id, code: TYPE_CODE }).session(session);
    if (!type) {
      [type] = await LetterType.create(
        [
          {
            tenantId: tenant._id,
            name: TYPE_NAME,
            code: TYPE_CODE,
            formatPattern: PATTERN,
            padding: 3,
            resetPolicy: "yearly",
            perUnit: false,
            approverIds: [admin._id],
          },
        ],
        { session },
      );
    }
    if (await Letter.exists({ tenantId: tenant._id, letterTypeId: type._id }).session(session)) {
      throw new Error("Jenis surat ini sudah punya surat. Impor dibatalkan agar tidak ganda.");
    }

    const counterKey = [String(tenant._id), String(type._id), "-", PERIOD].join(":");
    const docs = rows.map((r) => ({
      tenantId: tenant._id,
      letterTypeId: type!._id,
      unitId: null,
      requesterId: admin._id,
      subject: r.subject,
      recipient: "-",
      letterDate: r.date,
      status: "approved" as const,
      category: r.category,
      approvedBy: admin._id,
      approvedAt: r.date,
      number: { seq: r.seq, period: PERIOD, counterKey, full: r.full, formatVersion: type!.formatVersion, issuedAt: r.date },
      legacy: { sheetNo: r.sheetNo ?? undefined, creator: r.creator || undefined, note: r.notes.join("; ") || undefined },
    }));
    await Letter.insertMany(docs, { session });

    await Counter.updateOne(
      { key: counterKey },
      { $set: { seq: max }, $setOnInsert: { tenantId: tenant._id, letterTypeId: type._id, unitId: null, period: PERIOD } },
      { upsert: true, session },
    );
    await AuditLog.create(
      [{ tenantId: tenant._id, actorId: admin._id, action: "letters.import", entityType: "Letter", meta: { count: docs.length, max, source: "spreadsheet" } }],
      { session },
    );
  });
  console.log(`\nSelesai: ${rows.length} surat diimpor, counter diset ke ${max}.`);
  await mongoose.disconnect();
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Pemakaian: import-sheet.ts <file.csv> [--tenant=slug] [--apply]");
  const rows = parseSheet(readFileSync(file, "utf8"));
  const { max, dup, dupFull } = report(rows);
  if (dup.length || dupFull.length) throw new Error("Ada nomor ganda di sheet; perbaiki dulu.");

  if (!process.argv.includes("--apply")) {
    console.log("\nDRY RUN: tidak ada yang ditulis. Tambahkan --tenant=<slug> --apply untuk mengimpor.");
    return;
  }
  const slug = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];
  if (!slug) throw new Error("--tenant=<slug> wajib untuk --apply");
  await apply(rows, slug, max);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
