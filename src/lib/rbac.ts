import type { Types } from "mongoose";
import type { Role } from "@/models/User";

export type { Role };

/** Konteks pengguna yang sudah terautentikasi. */
export interface AuthUser {
  userId: string;
  tenantId: string | null;
  role: Role;
  unitId: string | null;
  name: string;
  email: string;
}

/** Konteks untuk semua operasi data instansi: tenantId pasti ada. */
export interface TenantCtx extends AuthUser {
  tenantId: string;
}

const eq = (a: Types.ObjectId | string | null | undefined, b: Types.ObjectId | string | null | undefined) =>
  !!a && !!b && String(a) === String(b);

export function canCreateLetter(ctx: TenantCtx): boolean {
  return ctx.role === "tenant_admin" || ctx.role === "unit_admin" || ctx.role === "staff";
}

/** Approver per jenis surat; tenant_admin selalu boleh. */
export function canApprove(ctx: TenantCtx, approverIds: Types.ObjectId[]): boolean {
  if (ctx.role === "tenant_admin") return true;
  return approverIds.some((id) => eq(id, ctx.userId));
}

/** Boleh MENGAJUKAN pembatalan: pemohon, admin unit terkait, tenant admin. */
export function canRequestCancel(
  ctx: TenantCtx,
  letter: { requesterId: Types.ObjectId; unitId: Types.ObjectId | null },
): boolean {
  if (ctx.role === "tenant_admin") return true;
  if (eq(letter.requesterId, ctx.userId)) return true;
  return ctx.role === "unit_admin" && eq(letter.unitId, ctx.unitId);
}

/** Boleh MEMBATALKAN: tenant admin atau admin unit terkait. */
export function canCancel(ctx: TenantCtx, letter: { unitId: Types.ObjectId | null }): boolean {
  if (ctx.role === "tenant_admin") return true;
  return ctx.role === "unit_admin" && eq(letter.unitId, ctx.unitId);
}
