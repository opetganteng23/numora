/**
 * Uji integrasi terhadap MongoDB sungguhan (replica set, karena memakai transaksi).
 * Dilewati bila TEST_MONGODB_URI tidak diisi. JANGAN arahkan ke database produksi:
 *   TEST_MONGODB_URI="mongodb+srv://.../numora_test" npm run test:integration
 * Setiap uji membuat instansi sendiri dan semuanya dihapus di akhir.
 */
import type { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TenantCtx } from "@/lib/rbac";

const URI = process.env.TEST_MONGODB_URI;
process.env.MAIL_DISABLED = "1";
if (URI) process.env.MONGODB_URI = URI;

describe.skipIf(!URI)("penomoran, isolasi instansi, dan kebijakan persetujuan", () => {
  let M: typeof import("@/models");
  let S: typeof import("@/services/letters");
  let mongoose: typeof import("mongoose").default;
  const tenantIds: Types.ObjectId[] = [];

  const mkTenant = async (allowSelfApproval = false) => {
    const t = await M.Tenant.create({ name: "Uji", slug: `uji-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, allowSelfApproval });
    tenantIds.push(t._id as Types.ObjectId);
    return t;
  };
  const mkUser = async (tenantId: unknown, role: string, unitId: unknown = null) => {
    const id = Math.random().toString(36).slice(2, 9);
    return M.User.create({ tenantId, name: `U ${id}`, email: `${id}@uji.test`, passwordHash: "x", role, unitId });
  };
  const ctxOf = (u: { _id: unknown; name: string; email: string; role: string; unitId?: unknown }, tenantId: unknown): TenantCtx => ({
    userId: String(u._id),
    tenantId: String(tenantId),
    role: u.role as TenantCtx["role"],
    unitId: u.unitId ? String(u.unitId) : null,
    name: u.name,
    email: u.email,
  });
  const mkType = (tenantId: unknown, approverIds: unknown[] = []) =>
    M.LetterType.create({ tenantId, name: "Surat Uji", code: "UJI", formatPattern: "{urut}/UJI/{tahun}", resetPolicy: "yearly", approverIds });
  const submit = (ctx: TenantCtx, typeId: unknown, extra: object = {}) =>
    S.createLetter(ctx, { letterTypeId: String(typeId), subject: "Perihal", recipient: "Tujuan", letterDate: new Date(), ...extra });

  beforeAll(async () => {
    mongoose = (await import("mongoose")).default;
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    M = await import("@/models");
    S = await import("@/services/letters");
    for (const m of [M.Tenant, M.User, M.Unit, M.LetterType, M.Counter, M.Letter, M.AuditLog]) {
      await m.createCollection().catch(() => undefined);
      await m.syncIndexes();
    }
  });

  afterAll(async () => {
    if (!mongoose) return;
    const filter = { tenantId: { $in: tenantIds } };
    const models = [M.Letter, M.Counter, M.AuditLog, M.LetterType, M.Unit, M.User] as unknown as Array<{ deleteMany: (f: object) => Promise<unknown> }>;
    await Promise.all(models.map((m) => m.deleteMany(filter)));
    await M.Tenant.deleteMany({ _id: { $in: tenantIds } });
    await mongoose.disconnect();
  });

  it("instansi B tidak dapat melihat atau mengubah surat instansi A", async () => {
    const a = await mkTenant(true);
    const b = await mkTenant(true);
    const adminA = await mkUser(a._id, "tenant_admin");
    const adminB = await mkUser(b._id, "tenant_admin");
    const typeA = await mkType(a._id, [adminA._id]);
    const ctxA = ctxOf(adminA, a._id);
    const ctxB = ctxOf(adminB, b._id);
    const letter = await submit(ctxA, typeA._id);

    expect((await S.listLetters(ctxB, { page: 1, limit: 50 })).total).toBe(0);
    await expect(S.approveLetter(ctxB, String(letter._id))).rejects.toMatchObject({ status: 404 });
    await expect(S.rejectLetter(ctxB, String(letter._id), "uji")).rejects.toMatchObject({ status: 404 });
    await expect(S.cancelLetter(ctxB, String(letter._id), "uji")).rejects.toMatchObject({ status: 404 });
    await expect(submit(ctxB, typeA._id)).rejects.toMatchObject({ status: 404 }); // jenis surat milik A
    expect((await S.getDashboard(ctxB)).status.pending).toBe(0);
    expect(await S.listCategories(ctxB)).toEqual([]);
  });

  it("staf tidak boleh menyetujui, dan hanya melihat suratnya sendiri", async () => {
    const t = await mkTenant();
    const admin = await mkUser(t._id, "tenant_admin");
    const unit = await M.Unit.create({ tenantId: t._id, name: "Unit", code: "U1" });
    const staff1 = await mkUser(t._id, "staff", unit._id);
    const staff2 = await mkUser(t._id, "staff", unit._id);
    const type = await mkType(t._id, [admin._id]);
    const l1 = await submit(ctxOf(staff1, t._id), type._id);

    await expect(S.approveLetter(ctxOf(staff1, t._id), String(l1._id))).rejects.toMatchObject({ status: 403 });
    await expect(S.approveLetter(ctxOf(staff2, t._id), String(l1._id))).rejects.toMatchObject({ status: 403 });
    expect((await S.listLetters(ctxOf(staff1, t._id), { page: 1, limit: 50 })).total).toBe(1);
    expect((await S.listLetters(ctxOf(staff2, t._id), { page: 1, limit: 50 })).total).toBe(0);
    expect((await S.listLetters(ctxOf(admin, t._id), { page: 1, limit: 50 })).total).toBe(1);
  });

  it("staf tidak dapat mengajukan atas nama unit lain", async () => {
    const t = await mkTenant();
    const u1 = await M.Unit.create({ tenantId: t._id, name: "Satu", code: "S1" });
    const u2 = await M.Unit.create({ tenantId: t._id, name: "Dua", code: "S2" });
    const staff = await mkUser(t._id, "staff", u1._id);
    const type = await mkType(t._id);
    await expect(submit(ctxOf(staff, t._id), type._id, { unitId: String(u2._id) })).rejects.toMatchObject({ status: 403 });
  });

  it("self-approval ditolak secara default dan diizinkan bila kebijakan instansi mengizinkan", async () => {
    const t = await mkTenant(false);
    const admin = await mkUser(t._id, "tenant_admin");
    const ctx = ctxOf(admin, t._id);
    const type = await mkType(t._id, [admin._id]);
    const l = await submit(ctx, type._id);
    await expect(S.approveLetter(ctx, String(l._id))).rejects.toMatchObject({ status: 403 });
    await expect(S.rejectLetter(ctx, String(l._id), "uji")).rejects.toMatchObject({ status: 403 });
    const row = (await S.listLetters(ctx, { page: 1, limit: 5 })).items[0];
    expect(row.can.approve).toBe(false);

    await M.Tenant.updateOne({ _id: t._id }, { $set: { allowSelfApproval: true } });
    const ok = await S.approveLetter(ctx, String(l._id));
    expect(ok.number?.seq).toBe(1);
  });

  it("approver lain boleh menyetujui pengajuan orang lain", async () => {
    const t = await mkTenant(false);
    const admin = await mkUser(t._id, "tenant_admin");
    const staff = await mkUser(t._id, "staff");
    const type = await mkType(t._id, [admin._id]);
    const l = await submit(ctxOf(staff, t._id), type._id);
    const ok = await S.approveLetter(ctxOf(admin, t._id), String(l._id));
    expect(ok.status).toBe("approved");
  });

  it("penolakan tidak memakai nomor, pembatalan tidak memakai ulang nomor", async () => {
    const t = await mkTenant(true);
    const admin = await mkUser(t._id, "tenant_admin");
    const ctx = ctxOf(admin, t._id);
    const type = await mkType(t._id, [admin._id]);

    const rejected = await submit(ctx, type._id);
    await S.rejectLetter(ctx, String(rejected._id), "ditolak uji");
    const first = await S.approveLetter(ctx, String((await submit(ctx, type._id))._id));
    expect(first.number?.seq).toBe(1); // tolak tidak membuat bolong

    await S.cancelLetter(ctx, String(first._id), "batal uji");
    const second = await S.approveLetter(ctx, String((await submit(ctx, type._id))._id));
    expect(second.number?.seq).toBe(2); // nomor 1 tidak dipakai ulang
    expect(second.number?.full).not.toBe(first.number?.full);
  });

  it("surat yang sama disetujui bersamaan: hanya satu yang berhasil dan counter naik sekali", async () => {
    const t = await mkTenant(true);
    const admin = await mkUser(t._id, "tenant_admin");
    const ctx = ctxOf(admin, t._id);
    const type = await mkType(t._id, [admin._id]);
    const l = await submit(ctx, type._id);
    const res = await Promise.allSettled(Array.from({ length: 8 }, () => S.approveLetter(ctx, String(l._id))));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const counter = await M.Counter.findOne({ tenantId: t._id }).lean();
    expect(counter?.seq).toBe(1);
  });

  it("surat berbeda disetujui bersamaan: nomor unik dan berurutan tanpa bolong", async () => {
    const t = await mkTenant(true);
    const admin = await mkUser(t._id, "tenant_admin");
    const ctx = ctxOf(admin, t._id);
    const type = await mkType(t._id, [admin._id]);
    const letters = [];
    for (let i = 0; i < 25; i++) letters.push(await submit(ctx, type._id));
    const res = await Promise.allSettled(letters.map((l) => S.approveLetter(ctx, String(l._id))));
    const seqs = res.flatMap((r) => (r.status === "fulfilled" ? [r.value.number!.seq] : [])).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});
