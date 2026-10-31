/**
 * Cadangan logis seluruh database (semua koleksi) ke satu berkas .jsonl.gz.
 *
 *   npm run backup                      (memakai MONGODB_URI)
 *   BACKUP_DIR=~/backups/numora KEEP_DAYS=14 npm run backup
 *
 * Format: satu baris JSON per dokumen: {"c":"<koleksi>","d":<EJSON>}.
 * Berkas lama yang melewati KEEP_DAYS dihapus. Pulihkan dengan scripts/restore.ts.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { once } from "node:events";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";

const { EJSON } = mongoose.mongo.BSON;

async function main() {
  const dir = (process.env.BACKUP_DIR ?? join(homedir(), "backups", "numora")).replace(/^~/, homedir());
  const keepDays = Number(process.env.KEEP_DAYS ?? 14);
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  await connectDB();
  const db = mongoose.connection.db!;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const file = join(dir, `numora-${stamp}.jsonl.gz`);

  const gz = createGzip();
  const out = createWriteStream(file, { mode: 0o600 });
  gz.pipe(out);

  const counts: Record<string, number> = {};
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (name.startsWith("system.")) continue;
    let n = 0;
    for await (const doc of db.collection(name).find({})) {
      if (!gz.write(JSON.stringify({ c: name, d: EJSON.serialize(doc) }) + "\n")) await once(gz, "drain");
      n++;
    }
    counts[name] = n;
  }
  gz.end();
  await once(out, "finish");

  // Arsip berkas dokumen (jika ada)
  const storage = (process.env.STORAGE_DIR ?? "").replace(/^~/, homedir());
  if (storage && existsSync(storage)) {
    const tarFile = join(dir, `numora-files-${stamp}.tar.gz`);
    execFileSync("tar", ["czf", tarFile, "-C", storage, "."]);
    chmodSync(tarFile, 0o600);
    console.log(`berkas: ${tarFile} (${(statSync(tarFile).size / 1024).toFixed(1)} KB)`);
  }

  // Hapus cadangan yang sudah melewati masa simpan
  const limit = Date.now() - keepDays * 86_400_000;
  for (const f of readdirSync(dir)) {
    if (/^numora-.*\.jsonl\.gz$/.test(f) && statSync(join(dir, f)).mtimeMs < limit) unlinkSync(join(dir, f));
  }

  console.log(`cadangan: ${file} (${(statSync(file).size / 1024).toFixed(1)} KB)`);
  console.log(counts);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
