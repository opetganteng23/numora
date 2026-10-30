import bcrypt from "bcryptjs";

const COST = 12;
let dummyHash: string | null = null;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/**
 * Bila user tidak ditemukan, tetap lakukan perbandingan ke hash palsu agar waktu
 * respons tidak membocorkan apakah email terdaftar.
 */
export async function verifyPassword(plain: string, hash: string | undefined): Promise<boolean> {
  if (!hash) {
    dummyHash ??= await bcrypt.hash("numora-dummy-password", COST);
    await bcrypt.compare(plain, dummyHash);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
