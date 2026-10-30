import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { User } from "@/models";
import { audit } from "@/services/audit";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, "Password baru minimal 10 karakter").max(200),
});

export const POST = handle(async (req) => {
  rateLimit(req, { key: "chgpw", limit: 10, windowMs: 15 * 60000 });
  const me = await requireUser();
  const { currentPassword, newPassword } = await parseBody(req, schema);
  const user = await User.findById(me.userId).select("+passwordHash tenantId");
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) throw new AppError(403, "Password saat ini salah");
  if (currentPassword === newPassword) throw new AppError(422, "Password baru harus berbeda");
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await audit({ tenantId: user.tenantId, actorId: user._id, action: "user.password_change", entityType: "User", entityId: user._id });
  return json({ ok: true });
});
