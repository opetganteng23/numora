import { requireTenantUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resendInvitation } from "@/services/invitations";

export const POST = handle(async (req, { params }) => {
  rateLimit(req, { key: "resend", limit: 20, windowMs: 3600000 });
  const ctx = await requireTenantUser(["tenant_admin"]);
  const { id } = await params;
  return json(await resendInvitation(ctx.tenantId, id, ctx.userId));
});
