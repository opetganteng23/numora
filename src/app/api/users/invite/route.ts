import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { handle, json, parseBody } from "@/lib/http";
import { inviteUser } from "@/services/invitations";

const schema = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().min(2).max(120),
  role: z.enum(["tenant_admin", "unit_admin", "staff", "auditor"]),
  unitId: z.string().regex(/^[a-f\d]{24}$/i).nullish(),
});

export const POST = handle(async (req) => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  const body = await parseBody(req, schema);
  const result = await inviteUser({ ...body, tenantId: ctx.tenantId, invitedBy: ctx.userId });
  return json(result, 201);
});
