import { requireTenantUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle } from "@/lib/http";
import { downloadDocument } from "@/services/documents";

export const GET = handle(async (_req, { params }) => {
  const ctx = await requireTenantUser();
  const { id, version } = await params;
  const v = Number(version);
  if (!Number.isInteger(v) || v < 1) throw new AppError(400, "Versi tidak valid");
  const { data, doc } = await downloadDocument(ctx, id, v);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(data.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
