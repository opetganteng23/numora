import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";
import { appUrl, resetMail } from "@/lib/mail-templates";
import { sendMail } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";
import { PasswordReset, Tenant, User } from "@/models";
import { audit } from "./audit";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 jam
const MIN_GAP_MS = 60 * 1000; // satu permintaan per menit per akun
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Selalu selesai tanpa error, apa pun hasilnya, agar respons tidak membocorkan
 * apakah email terdaftar. Email hanya dikirim untuk akun aktif.
 */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.toLowerCase().trim();
  const user = await User.findOne({ email, status: "active" }).select("name email tenantId").lean();
  if (!user) return;
  if (user.tenantId) {
    const t = await Tenant.findById(user.tenantId).select("status").lean();
    if (!t || t.status !== "active") return;
  }

  const recent = await PasswordReset.findOne({ userId: user._id, createdAt: { $gt: new Date(Date.now() - MIN_GAP_MS) } })
    .select("_id")
    .lean();
  if (recent) return;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await PasswordReset.create({ userId: user._id, tokenHash: sha256(token), expiresAt });

  const link = `${appUrl()}/reset-password?token=${token}`;
  await sendMail({ to: user.email, ...resetMail({ name: user.name, link, expiresAt }) });
  await audit({ tenantId: user.tenantId, actorId: user._id, action: "user.password_reset_request", entityType: "User", entityId: user._id });
}

/** Token sekali pakai (klaim atomik). Berhasil: password diganti dan kunci akun dibuka. */
export async function resetPassword(token: string, password: string): Promise<void> {
  const now = new Date();
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { new: true },
  );
  if (!reset) throw new AppError(400, "Tautan tidak valid atau sudah kedaluwarsa");

  try {
    const user = await User.findOneAndUpdate(
      { _id: reset.userId, status: "active" },
      { $set: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } },
      { new: true },
    );
    if (!user) throw new AppError(400, "Akun tidak aktif");
    // Matikan semua tautan reset lain milik akun ini
    await PasswordReset.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: now } });
    await audit({ tenantId: user.tenantId, actorId: user._id, action: "user.password_reset", entityType: "User", entityId: user._id });
  } catch (e) {
    await PasswordReset.updateOne({ _id: reset._id }, { $set: { usedAt: null } });
    throw e;
  }
}
