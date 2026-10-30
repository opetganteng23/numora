import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { handle, json, parseBody } from "@/lib/http";
import { Unit } from "@/models";
import { audit } from "@/services/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,20}$/, "Kode: huruf besar/angka/titik/strip, maks 20"),
});

export const GET = handle(async () => {
  const ctx = await requireTenantUser();
  const items = await Unit.find({ tenantId: ctx.tenantId }).sort({ name: 1 }).lean();
  return json({ items });
});

export const POST = handle(async (req) => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  const body = await parseBody(req, schema);
  const unit = await Unit.create({ ...body, tenantId: ctx.tenantId });
  await audit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "unit.create", entityType: "Unit", entityId: unit._id });
  return json({ item: unit.toObject() }, 201);
});
