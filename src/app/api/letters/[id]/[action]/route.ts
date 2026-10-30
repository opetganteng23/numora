import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { approveLetter, cancelLetter, rejectLetter, requestCancel } from "@/services/letters";

const reasonSchema = z.object({ reason: z.string().trim().min(3, "Alasan minimal 3 karakter").max(500) });

/**
 * POST /api/letters/:id/approve         setujui & terbitkan nomor
 * POST /api/letters/:id/reject          tolak (body: reason)
 * POST /api/letters/:id/cancel-request  ajukan pembatalan (body: reason)
 * POST /api/letters/:id/cancel          batalkan nomor (body: reason)
 */
export const POST = handle(async (req, { params }) => {
  const { id, action } = await params;
  const ctx = await requireTenantUser();

  switch (action) {
    case "approve":
      return json({ letter: await approveLetter(ctx, id) });
    case "reject": {
      const { reason } = await parseBody(req, reasonSchema);
      return json({ letter: await rejectLetter(ctx, id, reason) });
    }
    case "cancel-request": {
      const { reason } = await parseBody(req, reasonSchema);
      return json({ letter: await requestCancel(ctx, id, reason) });
    }
    case "cancel": {
      const { reason } = await parseBody(req, reasonSchema);
      return json({ letter: await cancelLetter(ctx, id, reason) });
    }
    default:
      throw new AppError(404, "Aksi tidak dikenal");
  }
});
