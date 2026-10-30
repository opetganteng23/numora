import type { ClientSession, Types } from "mongoose";
import { AuditLog } from "@/models";

interface AuditEntry {
  tenantId: Types.ObjectId | string | null;
  actorId: Types.ObjectId | string | null;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId | string | null;
  meta?: Record<string, unknown>;
}

/** Catat aktivitas. Kirim `session` agar log ikut masuk/rollback bersama transaksi bisnis. */
export async function audit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  await AuditLog.create(
    [
      {
        tenantId: entry.tenantId ?? null,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        meta: entry.meta,
      },
    ],
    { session },
  );
}
