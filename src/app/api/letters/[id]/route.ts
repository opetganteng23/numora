import { Types } from "mongoose";
import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { Letter } from "@/models";
import { audit } from "@/services/audit";
import { getLetter } from "@/services/letters";

export const GET = handle(async (_req, { params }) => {
  const ctx = await requireTenantUser();
  const { id } = await params;
  return json(await getLetter(ctx, id));
});

/** Admin instansi merapikan kategori surat. Tidak mengubah nomor atau urutan. */
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const { category } = await parseBody(req, z.object({ category: z.string().trim().max(60) }));
  const tenantId = new Types.ObjectId(ctx.tenantId);
  const before = await Letter.findOne({ _id: id, tenantId }).select("category").lean();
  if (!before) throw new AppError(404, "Surat tidak ditemukan");
  await Letter.updateOne({ _id: id, tenantId }, category ? { $set: { category } } : { $unset: { category: "" } });
  await audit({ tenantId, actorId: ctx.userId, action: "letter.category_edit", entityType: "Letter", entityId: id, meta: { from: before.category ?? null, to: category || null } });
  return json({ ok: true });
});
