import { createHmac } from "node:crypto";

/** Kode verifikasi publik per surat: tidak bisa ditebak dan tidak perlu disimpan. */
export function verifyCode(letterId: string): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET belum diatur");
  return createHmac("sha256", s).update(`verify:${letterId}`).digest("hex").slice(0, 20);
}

export function verifyPath(letterId: string) {
  return `/verify/${letterId}/${verifyCode(letterId)}`;
}
