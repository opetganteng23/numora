import { Types } from "mongoose";
import { connectDB } from "./db";
import { AppError } from "./errors";
import { getSessionUserId } from "./session";
import type { AuthUser, Role, TenantCtx } from "./rbac";
import { Tenant, User } from "@/models";

/** Baca user dari sesi + validasi ulang ke DB (status user & instansi). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const uid = await getSessionUserId();
  if (!uid || !Types.ObjectId.isValid(uid)) return null;

  await connectDB();
  const u = await User.findById(uid).lean();
  if (!u || u.status !== "active") return null;

  if (u.tenantId) {
    const t = await Tenant.findById(u.tenantId).select("status").lean();
    if (!t || t.status !== "active") return null;
  }
  return {
    userId: String(u._id),
    tenantId: u.tenantId ? String(u.tenantId) : null,
    role: u.role,
    unitId: u.unitId ? String(u.unitId) : null,
    name: u.name,
    email: u.email,
  };
}

export async function requireUser(roles?: Role[]): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError(401, "Silakan login terlebih dahulu");
  if (roles && !roles.includes(user.role)) throw new AppError(403, "Anda tidak memiliki akses");
  return user;
}

/** Untuk semua endpoint data instansi. Super admin tidak punya akses ke isi surat instansi. */
export async function requireTenantUser(roles?: Role[]): Promise<TenantCtx> {
  const user = await requireUser(roles);
  if (!user.tenantId || user.role === "super_admin") {
    throw new AppError(403, "Endpoint ini hanya untuk pengguna instansi");
  }
  return { ...user, tenantId: user.tenantId };
}
