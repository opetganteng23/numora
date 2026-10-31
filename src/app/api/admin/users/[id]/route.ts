import { Types } from "mongoose";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { User } from "@/models";
import { audit } from "@/services/audit";

const schema = z
  .object({ status: z.enum(["active", "disabled"]).optional(), unlock: z.literal(true).optional(), resetMfa: z.literal(true).optional() })
  .refine((v) => v.status !== undefined || v.unlock || v.resetMfa, "Tidak ada perubahan");

/** Super admin menonaktifkan akun, membuka kunci login, atau mereset MFA pengguna instansi (misalnya ponsel hilang dan kode pemulihan habis). */
export const PATCH = handle(async (req, { params }) => {
  const actor = await requireUser(["super_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const body = await parseBody(req, schema);
  const user = await User.findById(id);
  if (!user || !user.tenantId) throw new AppError(404, "Pengguna tidak ditemukan");

  if (body.status === "disabled" && user.role === "tenant_admin" && user.status === "active") {
    const others = await User.countDocuments({ tenantId: user.tenantId, role: "tenant_admin", status: "active", _id: { $ne: user._id } });
    if (others === 0) throw new AppError(409, "Instansi harus punya minimal satu admin aktif. Undang admin pengganti dulu.");
  }

  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  if (body.status) set.status = body.status;
  if (body.unlock) Object.assign(set, { lockedUntil: null, failedLogins: 0 });
  if (body.resetMfa) {
    set.mfaEnabled = false;
    Object.assign(unset, { mfaSecret: "", mfaLastStep: "", mfaRecovery: "" });
  }
  await User.updateOne({ _id: user._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  await audit({ tenantId: user.tenantId, actorId: actor.userId, action: "admin.user_update", entityType: "User", entityId: user._id, meta: { email: user.email, ...body } });
  return json({ ok: true });
});
