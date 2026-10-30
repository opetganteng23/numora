import { Types } from "mongoose";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { Tenant } from "@/models";
import { audit } from "@/services/audit";

const schema = z.object({ status: z.enum(["active", "suspended"]) });

/** Super admin menangguhkan atau mengaktifkan kembali instansi. Pengguna instansi langsung tidak bisa masuk saat ditangguhkan. */
export const PATCH = handle(async (req, { params }) => {
  const actor = await requireUser(["super_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const { status } = await parseBody(req, schema);
  const t = await Tenant.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!t) throw new AppError(404, "Instansi tidak ditemukan");
  await audit({ tenantId: t._id, actorId: actor.userId, action: "tenant.status", entityType: "Tenant", entityId: t._id, meta: { status } });
  return json({ item: t.toObject() });
});
