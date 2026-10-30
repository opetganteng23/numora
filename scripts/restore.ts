/**
 * Pulihkan cadangan dari scripts/backup.ts ke database TUJUAN.
 *
 *   RESTORE_URI="mongodb+srv://.../numora_restore" npx tsx scripts/restore.ts <berkas.jsonl.gz>
 *
 * Pengaman:
 * - Memakai RESTORE_URI (bukan MONGODB_URI) supaya tidak menimpa produksi tanpa sengaja.
 * - Menolak bila koleksi tujuan sudah berisi data, kecuali --force.
 * - Setelah selesai membandingkan jumlah dokumen dengan isi berkas.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import mongoose from "mongoose";

const { EJSON } = mongoose.mongo.BSON;

async function main() {
  const file = process.argv[2];
  const uri = process.env.RESTORE_URI;
  if (!file) throw new Error("Pemakaian: restore.ts <berkas.jsonl.gz>");
  if (!uri) throw new Error("RESTORE_URI wajib diisi (database tujuan)");
  if (uri === process.env.MONGODB_URI && !process.argv.includes("--force")) {
    throw new Error("RESTORE_URI sama dengan MONGODB_URI (produksi). Tambahkan --force bila memang disengaja.");
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db!;

  const expected: Record<string, number> = {};
  const batch: Record<string, unknown[]> = {};
  const flush = async (c: string) => {
    if (batch[c]?.length) {
      await db.collection(c).insertMany(batch[c] as never[], { ordered: false });
      batch[c] = [];
    }
  };

  const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  const checked = new Set<string>();
  for await (const line of rl) {
    if (!line.trim()) continue;
    const { c, d } = JSON.parse(line) as { c: string; d: unknown };
    if (!checked.has(c)) {
      checked.add(c);
      if ((await db.collection(c).estimatedDocumentCount()) > 0 && !process.argv.includes("--force")) {
        throw new Error(`Koleksi tujuan "${c}" sudah berisi data. Gunakan database kosong atau --force.`);
      }
    }
    (batch[c] ??= []).push(EJSON.deserialize(d as never));
    expected[c] = (expected[c] ?? 0) + 1;
    if (batch[c].length >= 500) await flush(c);
  }
  for (const c of Object.keys(batch)) await flush(c);

  let ok = true;
  for (const [c, n] of Object.entries(expected)) {
    const got = await db.collection(c).countDocuments();
    if (got !== n) ok = false;
    console.log(`${c.padEnd(14)} berkas=${n} tujuan=${got} ${got === n ? "OK" : "BEDA"}`);
  }
  console.log(ok ? "\nPEMULIHAN LULUS: jumlah dokumen sama." : "\nPEMULIHAN GAGAL: jumlah berbeda.");
  await mongoose.disconnect();
  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
