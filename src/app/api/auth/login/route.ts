import { z } from "zod";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { handle, json, parseBody } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { decryptSecret, verifyTotp } from "@/lib/totp";
import { Tenant, User } from "@/models";

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200), code: z.string().max(10).optional() });

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
    const step = verifyTotp(decryptSecret(user.mfaSecret), code.trim());
    if (step === null || step <= (user.mfaLastStep ?? 0)) {
      const upd = await User.findOneAndUpdate({ _id: user._id }, { $inc: { failedLogins: 1 } }, { new: true });
      if (upd && upd.failedLogins >= MAX_FAILED) {
        await User.updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(Date.now() + LOCK_MS), failedLogins: 0 } });
      }
      throw new AppError(401, "Kode autentikator salah", "MFA_REQUIRED");
    }
    await User.updateOne({ _id: user._id }, { $set: { mfaLastStep: step } });
  }

  await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(String(user._id));
  return json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
});
