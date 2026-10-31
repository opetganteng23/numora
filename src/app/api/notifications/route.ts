import { Types } from "mongoose";
import { requireTenantUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { Notification } from "@/models";

export const GET = handle(async () => {
  const ctx = await requireTenantUser();
  const userId = new Types.ObjectId(ctx.userId);
  const [items, unread] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return json({ unread, items });
});

/** Tandai semua notifikasi milik pengguna sebagai sudah dibaca. */
export const POST = handle(async () => {
  const ctx = await requireTenantUser();
  await Notification.updateMany({ userId: new Types.ObjectId(ctx.userId), readAt: null }, { $set: { readAt: new Date() } });
  return json({ ok: true });
});
