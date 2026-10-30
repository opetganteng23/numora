import mongoose, { Types } from "mongoose";
import { AppError, withRetry } from "@/lib/errors";
import { issueNumber } from "@/lib/issue-number";
import { canApprove, canCancel, canCreateLetter, canRequestCancel, type TenantCtx } from "@/lib/rbac";
import { Letter, LetterType, Tenant, Unit } from "@/models";
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

  const result = await withRetry(() =>
    mongoose.connection.transaction(async (session) => {
      const letter = await Letter.findOne({ _id: id, tenantId }).session(session);
      if (!letter) throw new AppError(404, "Surat tidak ditemukan");
      if (letter.status !== "pending") throw new AppError(409, "Surat ini sudah diproses");

      const type = await LetterType.findOne({ _id: letter.letterTypeId, tenantId }).session(session);
      if (!type) throw new AppError(404, "Jenis surat tidak ditemukan");
      if (!canApprove(ctx, type.approverIds)) {
        throw new AppError(403, "Anda bukan approver untuk jenis surat ini");
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
  q?: string;
  page: number;
  limit: number;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Daftar surat dengan cakupan sesuai peran. */
export async function listLetters(ctx: TenantCtx, input: ListLettersInput) {
  const tenantId = oid(ctx.tenantId);
  const and: Record<string, unknown>[] = [{ tenantId }];

  if (ctx.role === "staff" || ctx.role === "unit_admin") {
    // Milik sendiri + (unit_admin) unitnya + jenis surat yang ia approve
    const approvable = await LetterType.find({ tenantId, approverIds: oid(ctx.userId) }).distinct("_id");
    const scope: Record<string, unknown>[] = [{ requesterId: oid(ctx.userId) }, { letterTypeId: { $in: approvable } }];
    if (ctx.role === "unit_admin" && ctx.unitId) scope.push({ unitId: oid(ctx.unitId) });
    and.push({ $or: scope });
  }
  // tenant_admin & auditor: semua surat instansi

  if (input.status) and.push({ status: input.status });
  if (input.letterTypeId) and.push({ letterTypeId: oid(input.letterTypeId) });
  if (input.q) {
    const rx = new RegExp(escapeRegex(input.q), "i");
    and.push({ $or: [{ subject: rx }, { recipient: rx }, { "number.full": rx }] });
  }

  const filter = { $and: and };
  const [items, total] = await Promise.all([
    Letter.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean(),
    Letter.countDocuments(filter),
  ]);
  return { items, total, page: input.page, limit: input.limit };
}
