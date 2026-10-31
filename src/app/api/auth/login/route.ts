import { z } from "zod";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { handle, json, parseBody } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { decryptSecret, hashRecovery, isRecoveryCode, verifyTotp } from "@/lib/totp";
import { audit } from "@/services/audit";
import { Tenant, User } from "@/models";

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200), code: z.string().max(20).optional() });

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

export const POST = handle(async (req) => {
  rateLimit(req, { key: "login", limit: 15, windowMs: 300000 });
  const { email, password, code } = await parseBody(req, schema);
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash +mfaSecret +mfaLastStep");

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(429, "Akun dikunci sementara karena terlalu banyak percobaan. Coba lagi nanti.");
  }

  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok) {
    if (user) {
      const upd = await User.findOneAndUpdate({ _id: user._id }, { $inc: { failedLogins: 1 } }, { new: true });
      if (upd && upd.failedLogins >= MAX_FAILED) {
        await User.updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(Date.now() + LOCK_MS), failedLogins: 0 } });
      }
    }
    throw new AppError(401, "Email atau password salah");
  }

  if (user.status !== "active") throw new AppError(403, "Akun dinonaktifkan");
  if (user.tenantId) {
    const tenant = await Tenant.findById(user.tenantId).select("status").lean();
    if (!tenant || tenant.status !== "active") throw new AppError(403, "Instansi dinonaktifkan");
  }

  if (user.mfaEnabled && user.mfaSecret) {
    if (!code) throw new AppError(401, "Masukkan kode dari aplikasi autentikator", "MFA_REQUIRED");
    let passed = false;
    let step: number | null = null;
    if (isRecoveryCode(code)) {
      // Kode pemulihan sekali pakai: dihapus atomik saat dipakai
      const r = await User.updateOne({ _id: user._id, mfaRecovery: hashRecovery(code) }, { $pull: { mfaRecovery: hashRecovery(code) } });
      passed = r.modifiedCount === 1;
      if (passed) await audit({ tenantId: user.tenantId, actorId: user._id, action: "user.mfa_recovery_used", entityType: "User", entityId: user._id });
    } else {
      step = verifyTotp(decryptSecret(user.mfaSecret), code.trim());
      passed = step !== null && step > (user.mfaLastStep ?? 0);
    }
    if (!passed) {
      const upd = await User.findOneAndUpdate({ _id: user._id }, { $inc: { failedLogins: 1 } }, { new: true });
      if (upd && upd.failedLogins >= MAX_FAILED) {
        await User.updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(Date.now() + LOCK_MS), failedLogins: 0 } });
      }
      throw new AppError(401, "Kode autentikator salah", "MFA_REQUIRED");
    }
    if (step !== null) await User.updateOne({ _id: user._id }, { $set: { mfaLastStep: step } });
  }

  await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(String(user._id));
  return json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
});
