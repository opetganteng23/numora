import { requireTenantUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { uploadDocument } from "@/services/documents";

export const POST = handle(async (req, { params }) => {
  const ctx = await requireTenantUser();
  rateLimit(req, { key: `upload:${ctx.userId}`, limit: 30, windowMs: 60 * 60 * 1000 });
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new AppError(400, "Berkas wajib dipilih");
  const result = await uploadDocument(ctx, id, file.name, Buffer.from(await file.arrayBuffer()));
  return json(result, 201);
});
