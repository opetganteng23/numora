import { requireTenantUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { listPendingInvitations } from "@/services/invitations";

export const GET = handle(async () => {
  const ctx = await requireTenantUser(["tenant_admin"]);
  return json({ items: await listPendingInvitations(ctx.tenantId) });
});
