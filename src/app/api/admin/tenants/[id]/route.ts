import { Types } from "mongoose";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { AuditLog, Counter, Invitation, Letter, LetterType, Notification, Tenant, Unit, User } from "@/models";
import { audit } from "@/services/audit";

const schema = z
  .object({ status: z.enum(["active", "suspended"]).optional(), name: z.string().trim().min(2).max(120).optional() })
  .refine((v) => v.status !== undefined || v.name !== undefined, "Tidak ada perubahan");

/** Super admin mengganti nama, menangguhkan, atau mengaktifkan kembali instansi. Penangguhan langsung memblokir login semua penggunanya. */
export const PATCH = handle(async (req, { params }) => {
  const actor = await requireUser(["super_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const body = await parseBody(req, schema);
  const t = await Tenant.findByIdAndUpdate(id, { $set: body }, { new: true });
  if (!t) throw new AppError(404, "Instansi tidak ditemukan");
  await audit({ tenantId: t._id, actorId: actor.userId, action: body.status ? "tenant.status" : "tenant.rename", entityType: "Tenant", entityId: t._id, meta: body });
  return json({ item: t.toObject() });
});

/**
 * Hapus permanen instansi, hanya bila belum pernah menerbitkan atau mengajukan surat.
 * Instansi yang sudah punya surat tidak boleh dihapus (nomor adalah catatan hukum): tangguhkan saja.
 */
export const DELETE = handle(async (_req, { params }) => {
  const actor = await requireUser(["super_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const tenant = await Tenant.findById(id).lean();
  if (!tenant) throw new AppError(404, "Instansi tidak ditemukan");
  if (await Letter.exists({ tenantId: id })) throw new AppError(409, "Instansi ini sudah memiliki surat dan tidak dapat dihapus. Tangguhkan saja.");
  const filter = { tenantId: id };
  await Promise.all([User.deleteMany(filter), Unit.deleteMany(filter), LetterType.deleteMany(filter), Invitation.deleteMany(filter), Counter.deleteMany(filter), Notification.deleteMany(filter)]);
  await Tenant.deleteOne({ _id: id });
  await AuditLog.create({ tenantId: null, actorId: actor.userId, action: "tenant.delete", entityType: "Tenant", entityId: tenant._id, meta: { name: tenant.name, slug: tenant.slug } });
  return json({ ok: true });
});
