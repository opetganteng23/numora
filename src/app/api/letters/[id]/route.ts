import { requireTenantUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { getLetter } from "@/services/letters";

export const GET = handle(async (_req, { params }) => {
  const ctx = await requireTenantUser();
  const { id } = await params;
  return json(await getLetter(ctx, id));
});
