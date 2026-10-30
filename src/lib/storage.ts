import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Folder privat di luar `public/`. Atur lewat STORAGE_DIR di .env. */
function root() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Jenis berkas yang diizinkan, divalidasi lewat tanda awal berkas (bukan sekadar ekstensi). */
const TYPES: Record<string, { mime: string; match: (b: Buffer) => boolean }> = {
  pdf: { mime: "application/pdf", match: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", match: (b) => b[0] === 0x50 && b[1] === 0x4b },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", match: (b) => b[0] === 0x50 && b[1] === 0x4b },
  png: { mime: "image/png", match: (b) => b[0] === 0x89 && b.subarray(1, 4).toString("latin1") === "PNG" },
  jpg: { mime: "image/jpeg", match: (b) => b[0] === 0xff && b[1] === 0xd8 },
  jpeg: { mime: "image/jpeg", match: (b) => b[0] === 0xff && b[1] === 0xd8 },
};

export const ALLOWED_EXT = Object.keys(TYPES);

export function detectType(fileName: string, data: Buffer): { ext: string; mime: string } | null {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  const t = TYPES[ext];
  if (!t || !t.match(data)) return null;
  return { ext, mime: t.mime };
}

export function sha256(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

/** Simpan berkas dan kembalikan kunci penyimpanan relatif. Nama di disk tidak memakai nama asli. */
export async function putFile(tenantId: string, letterId: string, version: number, ext: string, data: Buffer) {
  const key = `${tenantId}/${letterId}/v${version}-${randomBytes(8).toString("hex")}.${ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { flag: "wx", mode: 0o600 });
  return key;
}

export async function getFile(key: string) {
  return readFile(resolveKey(key));
}

function resolveKey(key: string) {
  const base = root();
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Kunci penyimpanan tidak valid");
  return full;
}
