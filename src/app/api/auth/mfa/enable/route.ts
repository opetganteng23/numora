import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { decryptSecret, hashRecovery, newRecoveryCodes, verifyTotp } from "@/lib/totp";
import { User } from "@/models";
import { audit } from "@/services/audit";

export const POST = handle(async (req) => {
  rateLimit(req, { key: "mfa-enable", limit: 10, windowMs: 15 * 60000 });
  const me = await requireUser();
  const { code } = await parseBody(req, z.object({ code: z.string().regex(/^\d{6}$/, "Kode harus 6 angka") }));
  const user = await User.findById(me.userId).select("+mfaSecret tenantId mfaEnabled");
  if (!user?.mfaSecret) throw new AppError(409, "Mulai pendaftaran MFA terlebih dahulu");
  if (user.mfaEnabled) throw new AppError(409, "MFA sudah aktif");
  const step = verifyTotp(decryptSecret(user.mfaSecret), code);
  if (step === null) throw new AppError(422, "Kode salah. Pastikan jam perangkat Anda tepat.");
  const recoveryCodes = newRecoveryCodes();
  await User.updateOne({ _id: user._id }, { $set: { mfaEnabled: true, mfaLastStep: step, mfaRecovery: recoveryCodes.map(hashRecovery) } });
  await audit({ tenantId: user.tenantId, actorId: user._id, action: "user.mfa_enable", entityType: "User", entityId: user._id });
  return json({ ok: true, recoveryCodes });
});
