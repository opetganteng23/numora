import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { DEFAULT_PATTERN, validatePattern } from "@/lib/numbering";
import { LetterType } from "@/models";
import { audit } from "@/services/audit";
import { assertApprovers } from "@/services/letter-types";

const oidStr = z.string().regex(/^[a-f\d]{24}$/i);

const createTypeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,20}$/, "Kode: huruf besar/angka/titik/strip, maks 20"),
  formatPattern: z.string().trim().default(DEFAULT_PATTERN),
  padding: z.number().int().min(1).max(8).default(3),
  resetPolicy: z.enum(["yearly", "monthly", "never"]).default("yearly"),
  perUnit: z.boolean().default(false),
  approverIds: z.array(oidStr).max(20).default([]),
});

export const GET = handle(async () => {
  const ctx = await requireTenantUser();
  const items = await LetterType.find({ tenantId: ctx.tenantId }).sort({ name: 1 }).lean();
  return json({ items });
});

export const POST = handle(async (req) => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  const body = await parseBody(req, createTypeSchema);

  const errors = validatePattern(body.formatPattern, body.resetPolicy, body.perUnit);
  if (errors.length) throw new AppError(422, errors.join("; "), "INVALID_PATTERN");

  const approverIds = await assertApprovers(ctx.tenantId, body.approverIds);
  const type = await LetterType.create({ ...body, approverIds, tenantId: ctx.tenantId });
  await audit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "letter_type.create",
    entityType: "LetterType",
    entityId: type._id,
  });
  return json({ item: type.toObject() }, 201);
});
