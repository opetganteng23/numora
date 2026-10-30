import { requireTenantUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { listCategories } from "@/services/letters";

export const GET = handle(async () => {
  const ctx = await requireTenantUser();
  return json({ items: await listCategories(ctx) });
});
