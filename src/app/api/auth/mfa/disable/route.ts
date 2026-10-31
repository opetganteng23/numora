import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { decryptSecret, verifyTotp } from "@/lib/totp";
import { User } from "@/models";
import { audit } from "@/services/audit";

export const POST = handle(async (req) => {
  rateLimit(req, { key: "mfa-disable", limit: 10, windowMs: 15 * 60000 });
  const me = await requireUser();
  const { password, code } = await parseBody(req, z.object({ password: z.string().min(1).max(200), code: z.string().regex(/^\d{6}$/) }));
  const user = await User.findById(me.userId).select("+passwordHash +mfaSecret tenantId mfaEnabled");
  if (!user || !user.mfaEnabled || !user.mfaSecret) throw new AppError(409, "MFA belum aktif");
  if (!(await verifyPassword(password, user.passwordHash))) throw new AppError(403, "Password salah");
  if (verifyTotp(decryptSecret(user.mfaSecret), code) === null) throw new AppError(403, "Kode autentikator salah");
  await User.updateOne({ _id: user._id }, { $set: { mfaEnabled: false }, $unset: { mfaSecret: "", mfaLastStep: "", mfaRecovery: "" } });
  await audit({ tenantId: user.tenantId, actorId: user._id, action: "user.mfa_disable", entityType: "User", entityId: user._id });
  return json({ ok: true });
});
