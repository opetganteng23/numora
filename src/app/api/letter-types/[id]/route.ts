import { Types } from "mongoose";
import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { validatePattern } from "@/lib/numbering";
import { Letter, LetterType } from "@/models";
import { audit } from "@/services/audit";
import { assertApprovers } from "@/services/letter-types";

const oidStr = z.string().regex(/^[a-f\d]{24}$/i);

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  formatPattern: z.string().trim().optional(),
  padding: z.number().int().min(1).max(8).optional(),
  resetPolicy: z.enum(["yearly", "monthly", "never"]).optional(),
  perUnit: z.boolean().optional(),
  approverIds: z.array(oidStr).max(20).optional(),
  active: z.boolean().optional(),
});

export const PATCH = handle(async (req, { params }) => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const body = await parseBody(req, patchSchema);

  const type = await LetterType.findOne({ _id: id, tenantId: ctx.tenantId });
  if (!type) throw new AppError(404, "Jenis surat tidak ditemukan");

  const next = {
    formatPattern: body.formatPattern ?? type.formatPattern,
    resetPolicy: body.resetPolicy ?? type.resetPolicy,
    perUnit: body.perUnit ?? type.perUnit,
  };

  // Mengubah cara counter dikelompokkan setelah ada surat akan merusak kontinuitas nomor.
  const structuralChange = next.resetPolicy !== type.resetPolicy || next.perUnit !== type.perUnit;
  if (structuralChange && (await Letter.exists({ tenantId: ctx.tenantId, letterTypeId: type._id }))) {
    throw new AppError(409, "Aturan reset/per-unit tidak dapat diubah setelah ada surat pada jenis ini");
  }

  const errors = validatePattern(next.formatPattern, next.resetPolicy, next.perUnit);
  if (errors.length) throw new AppError(422, errors.join("; "), "INVALID_PATTERN");

  if (body.approverIds) type.approverIds = await assertApprovers(ctx.tenantId, body.approverIds);
  if (body.name !== undefined) type.name = body.name;
  if (body.padding !== undefined) type.padding = body.padding;
  if (body.active !== undefined) type.active = body.active;
  if (next.formatPattern !== type.formatPattern || (body.padding !== undefined && body.padding !== type.padding)) {
    type.formatVersion += 1; // nomor lama tetap membawa versi format lamanya
  }
  type.formatPattern = next.formatPattern;
  type.resetPolicy = next.resetPolicy;
  type.perUnit = next.perUnit;

  await type.save();
  await audit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "letter_type.update", entityType: "LetterType", entityId: type._id, meta: body });
  return json({ item: type.toObject() });
});
