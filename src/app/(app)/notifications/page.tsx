import Link from "next/link";
import { Types } from "mongoose";
import { MarkRead } from "@/components/MarkRead";
import { requireTenantUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/client";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requireTenantUser();
  await connectDB();
  const items = await Notification.find({ userId: new Types.ObjectId(ctx.userId) }).sort({ createdAt: -1 }).limit(50).lean();
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifikasi</h1>
          <p className="muted">Pengajuan dan keputusan terbaru. Disimpan 90 hari.</p>
        </div>
        {unread > 0 && <MarkRead />}
      </div>
      <div className="card">
        {items.length === 0 ? (
          <p className="muted">Belum ada notifikasi.</p>
        ) : (
          <ol className="timeline">
            {items.map((n) => (
              <li key={String(n._id)}>
                <b>{n.readAt ? "" : "Baru. "}<Link href={`/letters/${n.letterId}`}>{n.text}</Link></b>
                <span className="muted small">{fmtDateTime((n as unknown as { createdAt: Date }).createdAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
