import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { handle, json, parseBody } from "@/lib/http";
import { Tenant } from "@/models";
import { audit } from "@/services/audit";

const schema = z.object({ allowSelfApproval: z.boolean() });

export const GET = handle(async () => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  const t = await Tenant.findById(ctx.tenantId).select("name allowSelfApproval timeZone").lean();
  return json({ settings: { name: t?.name, timeZone: t?.timeZone, allowSelfApproval: !!t?.allowSelfApproval } });
});

/** Kebijakan instansi. Perubahan dicatat di audit karena memengaruhi pemisahan tugas. */
export const PATCH = handle(async (req) => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  const body = await parseBody(req, schema);
  const before = await Tenant.findById(ctx.tenantId).select("allowSelfApproval").lean();
  await Tenant.updateOne({ _id: ctx.tenantId }, { $set: { allowSelfApproval: body.allowSelfApproval } });
  await audit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "tenant.settings_update",
    entityType: "Tenant",
    entityId: ctx.tenantId,
    meta: { allowSelfApproval: { before: !!before?.allowSelfApproval, after: body.allowSelfApproval } },
  });
  return json({ settings: body });
});
