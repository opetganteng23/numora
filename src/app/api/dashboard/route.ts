import { requireTenantUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { getDashboard } from "@/services/letters";

export const GET = handle(async () => {
  const ctx = await requireTenantUser();
  return json(await getDashboard(ctx));
});
