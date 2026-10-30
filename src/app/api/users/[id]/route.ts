import { Types } from "mongoose";
import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { Unit, User } from "@/models";
import { audit } from "@/services/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["tenant_admin", "unit_admin", "staff", "auditor"]).optional(),
  unitId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

/** Ubah nama, peran, unit, atau status aktif pengguna instansi. */
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const body = await parseBody(req, schema);

  const user = await User.findOne({ _id: id, tenantId: ctx.tenantId });
  if (!user) throw new AppError(404, "Pengguna tidak ditemukan");
  const self = String(user._id) === ctx.userId;
  if (self && (body.role !== undefined || body.status !== undefined)) {
    throw new AppError(409, "Anda tidak dapat mengubah peran atau status akun Anda sendiri");
  }

  const role = body.role ?? user.role;
  const unitId = body.unitId !== undefined ? body.unitId : user.unitId ? String(user.unitId) : null;
  if (unitId) {
    const unit = await Unit.exists({ _id: unitId, tenantId: ctx.tenantId });
    if (!unit) throw new AppError(404, "Unit kerja tidak ditemukan");
  }
  if (role === "unit_admin" && !unitId) throw new AppError(422, "Admin unit wajib memiliki unit kerja");

  // Selalu sisakan minimal satu admin instansi aktif
  const losesAdmin = user.role === "tenant_admin" && user.status === "active" && (role !== "tenant_admin" || body.status === "disabled");
  if (losesAdmin) {
    const others = await User.countDocuments({ tenantId: ctx.tenantId, role: "tenant_admin", status: "active", _id: { $ne: user._id } });
    if (others === 0) throw new AppError(409, "Instansi harus punya minimal satu admin instansi aktif");
  }

  const before = { role: user.role, status: user.status, unitId: user.unitId ? String(user.unitId) : null, name: user.name };
  if (body.name !== undefined) user.name = body.name;
  user.role = role;
  user.unitId = unitId ? new Types.ObjectId(unitId) : null;
  if (body.status !== undefined) user.status = body.status;
  await user.save();

  await audit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "user.update",
    entityType: "User",
    entityId: user._id,
    meta: { email: user.email, before, after: { role: user.role, status: user.status, unitId, name: user.name } },
  });
  return json({ ok: true });
});
