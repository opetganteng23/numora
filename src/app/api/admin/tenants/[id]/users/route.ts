import { Types } from "mongoose";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { User } from "@/models";
import { inviteUser } from "@/services/invitations";

export const GET = handle(async (_req, { params }) => {
  await requireUser(["super_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const items = await User.find({ tenantId: id }).select("name email role status mfaEnabled lastLoginAt lockedUntil").sort({ name: 1 }).lean();
  return json({ items });
});

/** Undang admin instansi tambahan (misalnya pengganti admin yang keluar). */
export const POST = handle(async (req, { params }) => {
  const actor = await requireUser(["super_admin"]);
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) throw new AppError(400, "ID tidak valid");
  const body = await parseBody(req, z.object({ email: z.string().email(), name: z.string().trim().min(2).max(120) }));
  const invite = await inviteUser({ tenantId: id, invitedBy: actor.userId, email: body.email, name: body.name, role: "tenant_admin" });
  return json({ invite }, 201);
});
