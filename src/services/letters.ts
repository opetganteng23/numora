import mongoose, { Types } from "mongoose";
import { AppError, withRetry } from "@/lib/errors";
import { issueNumber } from "@/lib/issue-number";
import { withLock } from "@/lib/mutex";
import { canApprove, canCancel, canCreateLetter, canRequestCancel, type TenantCtx } from "@/lib/rbac";
import { AuditLog, Letter, LetterType, Tenant, Unit, User } from "@/models";
import { audit } from "./audit";
import { notifyApprovers, notifyDecision } from "./notify";

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  return new Types.ObjectId(id);
};

export interface CreateLetterInput {
  letterTypeId: string;
  unitId?: string | null;
  subject: string;
  recipient: string;
  letterDate: Date;
  category?: string;
}

/** Pemohon mengajukan nomor. Di tahap ini BELUM ada nomor. */
export async function createLetter(ctx: TenantCtx, input: CreateLetterInput) {
  if (!canCreateLetter(ctx)) throw new AppError(403, "Peran Anda tidak dapat mengajukan nomor surat");

  const tenantId = oid(ctx.tenantId);
  const type = await LetterType.findOne({ _id: oid(input.letterTypeId), tenantId, active: true }).lean();
  if (!type) throw new AppError(404, "Jenis surat tidak ditemukan atau nonaktif");

  const unitIdStr = input.unitId ?? ctx.unitId;
  let unitId: Types.ObjectId | null = null;
  if (unitIdStr) {
    // Staf & admin unit hanya boleh mengajukan atas nama unitnya sendiri
    if (ctx.role !== "tenant_admin" && unitIdStr !== ctx.unitId) {
      throw new AppError(403, "Anda hanya dapat mengajukan untuk unit Anda sendiri");
    }
    const unit = await Unit.findOne({ _id: oid(unitIdStr), tenantId }).select("_id").lean();
    if (!unit) throw new AppError(404, "Unit kerja tidak ditemukan");
    unitId = unit._id;
  }

  const letter = await Letter.create({
    tenantId,
    letterTypeId: type._id,
    unitId,
    requesterId: oid(ctx.userId),
    subject: input.subject,
    recipient: input.recipient,
    letterDate: input.letterDate,
    category: input.category || undefined,
    status: "pending",
  });
  await audit({
    tenantId,
    actorId: ctx.userId,
    action: "letter.create",
    entityType: "Letter",
    entityId: letter._id,
    meta: { letterTypeId: String(type._id), subject: input.subject },
  });

  await notifyApprovers(String(letter._id));
  return letter.toObject();
}

/**
 * Setujui pengajuan & terbitkan nomor, dalam SATU transaksi:
 * baca surat -> cek wewenang -> naikkan counter -> simpan nomor -> audit.
 * Dua approver menyetujui surat yang sama bersamaan: yang kedua melihat status
 * sudah bukan pending dan ditolak (409); counter-nya ikut di-rollback.
 */
export async function approveLetter(ctx: TenantCtx, letterId: string) {
  const tenantId = oid(ctx.tenantId);
  const id = oid(letterId);

  const result = await withLock(`approve:${ctx.tenantId}`, () =>
    withRetry(() =>
    mongoose.connection.transaction(async (session) => {
      const letter = await Letter.findOne({ _id: id, tenantId }).session(session);
      if (!letter) throw new AppError(404, "Surat tidak ditemukan");
      if (letter.status !== "pending") throw new AppError(409, "Surat ini sudah diproses");

      const type = await LetterType.findOne({ _id: letter.letterTypeId, tenantId }).session(session);
      if (!type) throw new AppError(404, "Jenis surat tidak ditemukan");
      if (!canApprove(ctx, type.approverIds)) {
        throw new AppError(403, "Anda bukan approver untuk jenis surat ini");
      }
      const tenantCfg = await Tenant.findById(tenantId).select("allowSelfApproval").session(session).lean();
      if (String(letter.requesterId) === ctx.userId && !tenantCfg?.allowSelfApproval) {
        throw new AppError(403, "Anda tidak boleh menyetujui pengajuan Anda sendiri");
      }

      const unit = letter.unitId ? await Unit.findOne({ _id: letter.unitId, tenantId }).session(session) : null;
      const tenant = await Tenant.findById(tenantId).select("timeZone").session(session);

      const number = await issueNumber({
        session,
        tenantId,
        type,
        unit,
        now: new Date(),
        timeZone: tenant?.timeZone ?? "Asia/Jakarta",
      });

      letter.status = "approved";
      letter.number = number;
      letter.approvedBy = oid(ctx.userId);
      letter.approvedAt = number.issuedAt;
      await letter.save({ session });

      await audit(
        {
          tenantId,
          actorId: ctx.userId,
          action: "letter.approve",
          entityType: "Letter",
          entityId: letter._id,
          meta: { number: number.full, seq: number.seq, period: number.period },
        },
        session,
      );
      return letter.toObject();
    }),
    ),
  );

  await notifyDecision(letterId);
  return result;
}

export async function rejectLetter(ctx: TenantCtx, letterId: string, reason: string) {
  const tenantId = oid(ctx.tenantId);
  const letter = await Letter.findOne({ _id: oid(letterId), tenantId });
  if (!letter) throw new AppError(404, "Surat tidak ditemukan");

  const type = await LetterType.findOne({ _id: letter.letterTypeId, tenantId }).select("approverIds").lean();
  if (!type || !canApprove(ctx, type.approverIds)) {
    throw new AppError(403, "Anda bukan approver untuk jenis surat ini");
  }
  const cfg = await Tenant.findById(tenantId).select("allowSelfApproval").lean();
  if (String(letter.requesterId) === ctx.userId && !cfg?.allowSelfApproval) {
    throw new AppError(403, "Anda tidak boleh menolak pengajuan Anda sendiri; batalkan atau minta approver lain");
  }

  // Update bersyarat: hanya berhasil bila masih pending (aman dari balapan dengan approve)
  const updated = await Letter.findOneAndUpdate(
    { _id: letter._id, tenantId, status: "pending" },
    { $set: { status: "rejected", rejectedBy: oid(ctx.userId), rejectedAt: new Date(), rejectReason: reason } },
    { new: true },
  );
  if (!updated) throw new AppError(409, "Surat ini sudah diproses");

  await audit({
    tenantId,
    actorId: ctx.userId,
    action: "letter.reject",
    entityType: "Letter",
    entityId: letter._id,
    meta: { reason },
  });
  await notifyDecision(letterId);
  return updated.toObject();
}

/** Pemohon / admin unit mengajukan pembatalan nomor yang sudah terbit. */
export async function requestCancel(ctx: TenantCtx, letterId: string, reason: string) {
  const tenantId = oid(ctx.tenantId);
  const letter = await Letter.findOne({ _id: oid(letterId), tenantId }).lean();
  if (!letter) throw new AppError(404, "Surat tidak ditemukan");
  if (!canRequestCancel(ctx, letter)) throw new AppError(403, "Anda tidak dapat mengajukan pembatalan surat ini");

  const updated = await Letter.findOneAndUpdate(
    { _id: letter._id, tenantId, status: "approved", cancelRequest: { $exists: false } },
    { $set: { cancelRequest: { by: oid(ctx.userId), reason, at: new Date() } } },
    { new: true },
  );
  if (!updated) throw new AppError(409, "Hanya nomor terbit yang belum diajukan pembatalannya yang dapat diproses");

  await audit({
    tenantId,
    actorId: ctx.userId,
    action: "letter.cancel_request",
    entityType: "Letter",
    entityId: letter._id,
    meta: { reason },
  });
  return updated.toObject();
}

/** Admin unit / tenant admin membatalkan nomor. Nomor TIDAK dihapus dan TIDAK dipakai ulang. */
export async function cancelLetter(ctx: TenantCtx, letterId: string, reason: string) {
  const tenantId = oid(ctx.tenantId);
  const letter = await Letter.findOne({ _id: oid(letterId), tenantId }).lean();
  if (!letter) throw new AppError(404, "Surat tidak ditemukan");
  if (!canCancel(ctx, letter)) throw new AppError(403, "Anda tidak berwenang membatalkan surat ini");

  const updated = await Letter.findOneAndUpdate(
    { _id: letter._id, tenantId, status: "approved" },
    { $set: { status: "cancelled", cancelledBy: oid(ctx.userId), cancelledAt: new Date(), cancelReason: reason } },
    { new: true },
  );
  if (!updated) throw new AppError(409, "Hanya nomor yang sudah terbit yang dapat dibatalkan");

  await audit({
    tenantId,
    actorId: ctx.userId,
    action: "letter.cancel",
    entityType: "Letter",
    entityId: letter._id,
    meta: { reason, number: letter.number?.full },
  });
  return updated.toObject();
}

export interface ListLettersInput {
  status?: string;
  letterTypeId?: string;
  category?: string;
  q?: string;
  page: number;
  limit: number;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cakupan surat untuk staf dan admin unit: milik sendiri, unitnya (admin unit), dan jenis yang ia approve. */
async function scopeOr(ctx: TenantCtx): Promise<Record<string, unknown>[] | null> {
  if (ctx.role !== "staff" && ctx.role !== "unit_admin") return null;
  const tenantId = oid(ctx.tenantId);
  const approvable = await LetterType.find({ tenantId, approverIds: oid(ctx.userId) }).distinct("_id");
  const scope: Record<string, unknown>[] = [{ requesterId: oid(ctx.userId) }, { letterTypeId: { $in: approvable } }];
  if (ctx.role === "unit_admin" && ctx.unitId) scope.push({ unitId: oid(ctx.unitId) });
  return scope;
}

/** Daftar surat dengan cakupan sesuai peran. */
export async function listLetters(ctx: TenantCtx, input: ListLettersInput) {
  const tenantId = oid(ctx.tenantId);
  const and: Record<string, unknown>[] = [{ tenantId }];

  const scope = await scopeOr(ctx);
  if (scope) and.push({ $or: scope });
  // tenant_admin & auditor: semua surat instansi

  if (input.status) and.push({ status: input.status });
  if (input.letterTypeId) and.push({ letterTypeId: oid(input.letterTypeId) });
  if (input.category) and.push({ category: input.category });
  if (input.q) {
    const rx = new RegExp(escapeRegex(input.q), "i");
    and.push({ $or: [{ subject: rx }, { recipient: rx }, { category: rx }, { "number.full": rx }] });
  }

  const filter = { $and: and };
  const [items, total] = await Promise.all([
    Letter.find(filter)
      .sort({ letterDate: -1, "number.seq": -1, createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean(),
    Letter.countDocuments(filter),
  ]);
  const enriched = await enrich(ctx, items);
  return { items: enriched, total, page: input.page, limit: input.limit };
}

/** Tambahkan nama pemohon, nama jenis surat, dan hak aksi pengguna ini pada tiap surat. */
async function enrich<T extends Record<string, any>>(ctx: TenantCtx, items: T[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = oid(ctx.tenantId);
  const [users, types, tenant] = await Promise.all([
    User.find({ _id: { $in: [...new Set(items.map((i) => String(i.requesterId)))] } })
      .select("name")
      .lean(),
    LetterType.find({ tenantId, _id: { $in: [...new Set(items.map((i) => String(i.letterTypeId)))] } })
      .select("name approverIds")
      .lean(),
    Tenant.findById(tenantId).select("allowSelfApproval").lean(),
  ]);
  const uName = new Map(users.map((u) => [String(u._id), u.name]));
  const tMap = new Map(types.map((t) => [String(t._id), t]));
  return items.map((l) => {
    const type = tMap.get(String(l.letterTypeId));
    const own = String(l.requesterId) === ctx.userId;
    return {
      ...l,
      requesterName: uName.get(String(l.requesterId)) ?? "-",
      typeName: type?.name ?? "-",
      can: {
        approve: l.status === "pending" && !!type && canApprove(ctx, type.approverIds) && (!own || !!tenant?.allowSelfApproval),
        requestCancel: l.status === "approved" && !l.cancelRequest && canRequestCancel(ctx, l as unknown as { requesterId: Types.ObjectId; unitId: Types.ObjectId | null }),
        cancel: l.status === "approved" && canCancel(ctx, l as unknown as { unitId: Types.ObjectId | null }),
      },
    };
  });
}

export async function listCategories(ctx: TenantCtx): Promise<string[]> {
  const cats = (await Letter.distinct("category", { tenantId: oid(ctx.tenantId) })) as string[];
  return cats.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Ringkasan untuk dashboard, sesuai cakupan peran. */
export async function getDashboard(ctx: TenantCtx) {
  const tenantId = oid(ctx.tenantId);
  const scope: Record<string, unknown> = { tenantId };
  if (ctx.role === "staff" || ctx.role === "unit_admin") {
    const approvable = await LetterType.find({ tenantId, approverIds: oid(ctx.userId) }).distinct("_id");
    const or: Record<string, unknown>[] = [{ requesterId: oid(ctx.userId) }, { letterTypeId: { $in: approvable } }];
    if (ctx.role === "unit_admin" && ctx.unitId) or.push({ unitId: oid(ctx.unitId) });
    scope.$or = or;
  }
  const year = new Date().getFullYear();
  const [byStatus, byCategory, byMonth, recent, myPending] = await Promise.all([
    Letter.aggregate([{ $match: scope }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Letter.aggregate([
      { $match: { ...scope, status: "approved" } },
      { $group: { _id: { $ifNull: ["$category", "Belum dikategorikan"] }, n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 8 },
    ]),
    Letter.aggregate([
      { $match: { ...scope, status: "approved", letterDate: { $gte: new Date(Date.UTC(year, 0, 1)) } } },
      { $group: { _id: { $month: { date: "$letterDate", timezone: "Asia/Jakarta" } }, n: { $sum: 1 } } },
    ]),
    Letter.find(scope).sort({ letterDate: -1, "number.seq": -1, createdAt: -1 }).limit(6).lean(),
    Letter.countDocuments({ ...scope, status: "pending" }),
  ]);
  const status: Record<string, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  byStatus.forEach((r: { _id: string; n: number }) => (status[r._id] = r.n));
  const months = Array.from({ length: 12 }, (_, i) => byMonth.find((m: { _id: number; n: number }) => m._id === i + 1)?.n ?? 0);
  const lastNumber = await Letter.findOne({ tenantId, "number.seq": { $exists: true } })
    .sort({ "number.issuedAt": -1, "number.seq": -1 })
    .select("number.full")
    .lean();
  return {
    status,
    pending: myPending,
    categories: byCategory.map((c: { _id: string; n: number }) => ({ name: c._id, count: c.n })),
    months,
    year,
    recent: await enrich(ctx, recent),
    lastNumber: lastNumber?.number?.full ?? null,
  };
}

/** Detail satu surat beserta riwayat keputusannya. Cakupan akses sama dengan daftar surat. */
export async function getLetter(ctx: TenantCtx, letterId: string) {
  const tenantId = oid(ctx.tenantId);
  const and: Record<string, unknown>[] = [{ _id: oid(letterId), tenantId }];
  const scope = await scopeOr(ctx);
  if (scope) and.push({ $or: scope });

  const letter = await Letter.findOne({ $and: and }).lean();
  if (!letter) throw new AppError(404, "Surat tidak ditemukan");
  const [enriched] = await enrich(ctx, [letter]);

  const history = await AuditLog.find({ tenantId, entityType: "Letter", entityId: letter._id }).sort({ createdAt: 1 }).lean();
  const ids = new Set<string>();
  for (const h of history) if (h.actorId) ids.add(String(h.actorId));
  for (const k of ["approvedBy", "rejectedBy", "cancelledBy"] as const) if (letter[k]) ids.add(String(letter[k]));
  if (letter.cancelRequest?.by) ids.add(String(letter.cancelRequest.by));
  const users = await User.find({ _id: { $in: [...ids] } }).select("name").lean();
  const names = Object.fromEntries(users.map((u) => [String(u._id), u.name]));

  return {
    letter: enriched,
    names,
    history: history.map((h) => ({ action: h.action, actorId: h.actorId ? String(h.actorId) : null, at: (h as unknown as { createdAt: Date }).createdAt, meta: h.meta })),
  };
}
