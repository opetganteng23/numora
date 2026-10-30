import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { AuditLog } from "@/models";

const schema = z.object({
  entityType: z.string().max(40).optional(),
  entityId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const GET = handle(async (req) => {
  const ctx = await requireTenantUser(["tenant_admin", "auditor"]);
  const q = schema.parse(Object.fromEntries(req.nextUrl.searchParams));

  const filter: Record<string, unknown> = { tenantId: ctx.tenantId };
  if (q.entityType) filter.entityType = q.entityType;
  if (q.entityId) filter.entityId = q.entityId;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return json({ items, total, page: q.page, limit: q.limit });
});
