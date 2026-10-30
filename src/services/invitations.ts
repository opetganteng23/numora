import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { AppError } from "@/lib/errors";
import { appUrl, inviteMail } from "@/lib/mail-templates";
import { sendMail } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";
import type { Role } from "@/lib/rbac";
import { Invitation, Tenant, Unit, User } from "@/models";
import { audit } from "./audit";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface InviteInput {
  tenantId: string;
  invitedBy: string | null;
  email: string;
  name: string;
  role: Exclude<Role, "super_admin">;
  unitId?: string | null;
}

export async function inviteUser(input: InviteInput) {
  const email = input.email.toLowerCase().trim();
  const tenantId = new Types.ObjectId(input.tenantId);

  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) throw new AppError(404, "Instansi tidak ditemukan");
  if (await User.exists({ email })) throw new AppError(409, "Email ini sudah terdaftar");

  let unitId: Types.ObjectId | null = null;
  if (input.unitId) {
    const unit = await Unit.findOne({ _id: input.unitId, tenantId }).select("_id").lean();
    if (!unit) throw new AppError(404, "Unit kerja tidak ditemukan");
    unitId = unit._id;
  }
  if (input.role === "unit_admin" && !unitId) throw new AppError(422, "Admin unit wajib memiliki unit kerja");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invitation = await Invitation.create({
    tenantId,
    email,
    name: input.name,
    role: input.role,
    unitId,
    tokenHash: sha256(token),
    expiresAt,
    invitedBy: input.invitedBy ? new Types.ObjectId(input.invitedBy) : null,
  });

  const link = `${appUrl()}/accept-invite?token=${token}`;
  const emailSent = await sendMail({
    to: email,
    ...inviteMail({ name: input.name, tenantName: tenant.name, link, expiresAt }),
  });

  await audit({
    tenantId,
    actorId: input.invitedBy,
    action: "user.invite",
    entityType: "Invitation",
    entityId: invitation._id,
    meta: { email, role: input.role },
  });
  return { invitationId: String(invitation._id), expiresAt, emailSent };
}

/** Undangan yang belum dipakai dan belum kedaluwarsa (tanpa token). */
export async function listPendingInvitations(tenantId: string) {
  return Invitation.find({ tenantId, usedAt: null, expiresAt: { $gt: new Date() } })
    .select("email name role unitId expiresAt createdAt")
    .sort({ createdAt: -1 })
    .lean();
}

/** Kirim ulang: token lama dimatikan, token baru dibuat dengan masa berlaku baru. */
export async function resendInvitation(tenantId: string, invitationId: string, actorId: string) {
  if (!Types.ObjectId.isValid(invitationId)) throw new AppError(400, "ID tidak valid");
  const tenant = await Tenant.findById(tenantId).select("name").lean();
  if (!tenant) throw new AppError(404, "Instansi tidak ditemukan");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const inv = await Invitation.findOneAndUpdate(
    { _id: invitationId, tenantId, usedAt: null },
    { $set: { tokenHash: sha256(token), expiresAt } },
    { new: true },
  );
  if (!inv) throw new AppError(404, "Undangan tidak ditemukan atau sudah dipakai");
  if (await User.exists({ email: inv.email })) throw new AppError(409, "Email ini sudah terdaftar");

  const link = `${appUrl()}/accept-invite?token=${token}`;
  const emailSent = await sendMail({
    to: inv.email,
    ...inviteMail({ name: inv.name, tenantName: tenant.name, link, expiresAt }),
  });
  await audit({ tenantId, actorId, action: "user.invite_resend", entityType: "Invitation", entityId: inv._id, meta: { email: inv.email } });
  return { expiresAt, emailSent };
}

/** Pakai token undangan -> buat akun aktif. Token hanya bisa dipakai sekali (klaim atomik). */
export async function acceptInvitation(token: string, password: string) {
  const now = new Date();
  const invitation = await Invitation.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { new: true },
  );
  if (!invitation) throw new AppError(400, "Tautan undangan tidak valid atau sudah kedaluwarsa");

  try {
    const user = await User.create({
      tenantId: invitation.tenantId,
      name: invitation.name,
      email: invitation.email,
      passwordHash: await hashPassword(password),
      role: invitation.role,
      unitId: invitation.unitId,
      status: "active",
    });
    await audit({
      tenantId: invitation.tenantId,
      actorId: user._id,
      action: "user.accept_invite",
      entityType: "User",
      entityId: user._id,
    });
    return user._id;
  } catch (e) {
    // Gagal membuat akun (mis. email keburu terdaftar): kembalikan token agar tidak hangus.
    await Invitation.updateOne({ _id: invitation._id }, { $set: { usedAt: null } });
    throw e;
  }
}
