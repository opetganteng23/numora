import { Types } from "mongoose";
import { AppError } from "@/lib/errors";
import type { TenantCtx } from "@/lib/rbac";
import { detectType, getFile, MAX_UPLOAD_BYTES, putFile, sha256, ALLOWED_EXT } from "@/lib/storage";
import { Letter, LetterType } from "@/models";
import { audit } from "./audit";
import { getLetter } from "./letters";

/** Pemilik surat, approver jenis surat itu, dan admin instansi boleh mengunggah. Auditor hanya membaca. */
async function canUpload(ctx: TenantCtx, letter: { requesterId: unknown; letterTypeId: unknown }) {
  if (ctx.role === "tenant_admin") return true;
  if (ctx.role === "auditor") return false;
  if (String(letter.requesterId) === ctx.userId) return true;
  const type = await LetterType.findOne({ _id: letter.letterTypeId as Types.ObjectId, tenantId: new Types.ObjectId(ctx.tenantId) })
    .select("approverIds")
    .lean();
  return !!type?.approverIds?.some((a) => String(a) === ctx.userId);
}

export async function uploadDocument(ctx: TenantCtx, letterId: string, fileName: string, data: Buffer) {
  const { letter } = await getLetter(ctx, letterId); // juga memeriksa cakupan akses
  if (letter.status !== "approved") throw new AppError(409, "Dokumen hanya dapat diunggah untuk surat yang sudah bernomor");
  if (!(await canUpload(ctx, letter))) throw new AppError(403, "Anda tidak berwenang mengunggah dokumen untuk surat ini");
  if (data.length === 0) throw new AppError(400, "Berkas kosong");
  if (data.length > MAX_UPLOAD_BYTES) throw new AppError(413, `Ukuran berkas maksimal ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
  const type = detectType(fileName, data);
  if (!type) throw new AppError(400, `Jenis berkas tidak diizinkan atau isinya tidak cocok. Diizinkan: ${ALLOWED_EXT.join(", ")}`);

  const tenantId = new Types.ObjectId(ctx.tenantId);
  const current = await Letter.findOne({ _id: letter._id, tenantId }).select("documents.version").lean();
  const version = (current?.documents?.reduce((m, d) => Math.max(m, d.version), 0) ?? 0) + 1;
  const hash = sha256(data);
  const storageKey = await putFile(ctx.tenantId, letterId, version, type.ext, data);
  const safeName = fileName.replace(/[\\/\0]/g, "_").slice(0, 200);
  const doc = { version, fileName: safeName, mime: type.mime, size: data.length, sha256: hash, storageKey, uploadedBy: new Types.ObjectId(ctx.userId), uploadedAt: new Date() };

  // Versi harus unik: kalau dua unggahan bertabrakan, yang kedua gagal dan diminta mengulang.
  const res = await Letter.updateOne(
    { _id: letter._id, tenantId, "documents.version": { $ne: version } },
    { $push: { documents: doc } },
  );
  if (res.modifiedCount !== 1) throw new AppError(409, "Ada unggahan lain bersamaan, silakan coba lagi");
  await audit({ tenantId, actorId: ctx.userId, action: "letter.document_upload", entityType: "Letter", entityId: letter._id, meta: { version, fileName: safeName, sha256: hash, size: data.length } });
  return { version, sha256: hash };
}

export async function downloadDocument(ctx: TenantCtx, letterId: string, version: number) {
  const { letter } = await getLetter(ctx, letterId);
  const doc = letter.documents?.find((d) => d.version === version);
  if (!doc) throw new AppError(404, "Dokumen tidak ditemukan");
  const data = await getFile(doc.storageKey);
  if (sha256(data) !== doc.sha256) throw new AppError(500, "Integritas berkas gagal diverifikasi (hash tidak cocok)");
  await audit({ tenantId: ctx.tenantId, actorId: ctx.userId, action: "letter.document_download", entityType: "Letter", entityId: letter._id, meta: { version } });
  return { data, doc };
}
