/**
 * Uji beban/balapan untuk mesin penomoran. Jalankan terhadap database UJI (bukan produksi):
 *   npm run test:concurrency            (default 100 surat)
 *   N=300 npm run test:concurrency
 *
 * Yang diuji:
 *  1. N persetujuan bersamaan -> nomor harus unik dan berurutan 1..N tanpa bolong
 *  2. Satu surat disetujui 10 kali bersamaan -> hanya 1 yang berhasil
 * Data uji dihapus di akhir.
 */
import mongoose, { Types } from "mongoose";
import { connectDB } from "../src/lib/db";
import type { TenantCtx } from "../src/lib/rbac";
import { AuditLog, Counter, Letter, LetterType, Tenant, Unit, User } from "../src/models";
import { approveLetter, createLetter } from "../src/services/letters";

process.env.MAIL_DISABLED = "1";
const N = Number(process.env.N ?? 100);

async function main() {
  await connectDB();
  for (const m of [Tenant, User, Unit, LetterType, Counter, Letter, AuditLog]) {
    await m.createCollection().catch(() => undefined);
    await m.syncIndexes();
  }

  const tenant = await Tenant.create({ name: "Uji Konkurensi", slug: `conc-${Date.now()}` });
  const unit = await Unit.create({ tenantId: tenant._id, name: "Bagian Uji", code: "UJI" });
  const admin = await User.create({
    tenantId: tenant._id,
    name: "Admin Uji",
    email: `admin-${Date.now()}@example.test`,
    passwordHash: "x",
    role: "tenant_admin",
  });
  const type = await LetterType.create({
    tenantId: tenant._id,
    name: "Memorandum of Understanding",
    code: "MOU",
    formatPattern: "{urut}/{jenis}/{unit}/{bulan_romawi}/{tahun}",
    resetPolicy: "yearly",
    perUnit: false,
    approverIds: [admin._id],
  });

  const ctx: TenantCtx = {
    userId: String(admin._id),
    tenantId: String(tenant._id),
    role: "tenant_admin",
    unitId: null,
    name: admin.name,
    email: admin.email,
  };

  try {
    console.log(`Membuat ${N} pengajuan...`);
    const letters = [];
    for (let i = 0; i < N; i++) {
      letters.push(
        await createLetter(ctx, {
          letterTypeId: String(type._id),
          unitId: String(unit._id),
          subject: `Uji ${i + 1}`,
          recipient: "Pihak Uji",
          letterDate: new Date(),
        }),
      );
    }

    console.log(`Menyetujui ${N} surat secara bersamaan...`);
    const t0 = Date.now();
    const results = await Promise.allSettled(letters.map((l) => approveLetter(ctx, String(l._id))));
    const ms = Date.now() - t0;

    const failed = results.filter((r) => r.status === "rejected");
    const seqs = results
      .flatMap((r) => (r.status === "fulfilled" ? [r.value.number!.seq] : []))
      .sort((a, b) => a - b);
    const fulls = new Set(
      results.flatMap((r) => (r.status === "fulfilled" ? [r.value.number!.full] : [])),
    );

    const contiguous = seqs.every((s, i) => s === i + 1);
    const check1 = failed.length === 0 && seqs.length === N && fulls.size === N && contiguous;
    console.log(`  waktu: ${ms} ms | berhasil: ${seqs.length}/${N} | gagal: ${failed.length}`);
    console.log(`  unik: ${fulls.size === N} | berurutan 1..${N} tanpa bolong: ${contiguous}`);
    console.log(`  contoh: ${[...fulls].slice(0, 2).join("  ,  ")}`);
    if (failed.length) console.log("  contoh error:", (failed[0] as PromiseRejectedResult).reason);

    console.log("Menyetujui SATU surat 10x bersamaan...");
    const single = await createLetter(ctx, {
      letterTypeId: String(type._id),
      unitId: String(unit._id),
      subject: "Uji double approve",
      recipient: "Pihak Uji",
      letterDate: new Date(),
    });
    const dbl = await Promise.allSettled(Array.from({ length: 10 }, () => approveLetter(ctx, String(single._id))));
    const ok = dbl.filter((r) => r.status === "fulfilled").length;
    const counter = await Counter.findOne({ tenantId: tenant._id }).lean();
    const check2 = ok === 1 && counter?.seq === N + 1;
    console.log(`  berhasil: ${ok} (harus 1) | counter akhir: ${counter?.seq} (harus ${N + 1})`);

    console.log(check1 && check2 ? "\nLULUS: tidak ada nomor ganda maupun bolong" : "\nGAGAL");
    process.exitCode = check1 && check2 ? 0 : 1;
  } finally {
    const tid = tenant._id as Types.ObjectId;
    await Promise.all([
      Letter.deleteMany({ tenantId: tid }),
      Counter.deleteMany({ tenantId: tid }),
      AuditLog.deleteMany({ tenantId: tid }),
      LetterType.deleteMany({ tenantId: tid }),
      Unit.deleteMany({ tenantId: tid }),
      User.deleteMany({ tenantId: tid }),
      Tenant.deleteOne({ _id: tid }),
    ]);
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
