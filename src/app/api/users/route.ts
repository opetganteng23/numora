import { requireTenantUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { User } from "@/models";

/** Daftar pengguna instansi (untuk memilih approver, dll.). Tanpa passwordHash. */
export const GET = handle(async () => {
  const ctx = await requireTenantUser(["tenant_admin", "unit_admin", "auditor"]);
  const items = await User.find({ tenantId: ctx.tenantId })
    .select("name email role unitId status lastLoginAt")
    .sort({ name: 1 })
    .lean();
  return json({ items });
});
