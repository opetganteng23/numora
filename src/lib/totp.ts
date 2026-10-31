import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function b32encode(buf: Buffer) {
  let bits = 0;
  let val = 0;
  let out = "";
  for (const b of buf) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

function b32decode(s: string) {
  let bits = 0;
  let val = 0;
  const out: number[] = [];
  for (const c of s.replace(/=+$/, "")) {
    val = (val << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newSecret = () => b32encode(randomBytes(20));

const stepOf = (t: number) => Math.floor(t / 30000);

function hotp(secret: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", b32decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** Kembalikan langkah waktu yang cocok (toleransi satu langkah), atau null. Pemanggil menolak langkah yang sudah pernah dipakai. */
export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const cur = stepOf(now);
  for (const s of [cur, cur - 1, cur + 1]) if (hotp(secret, s) === code) return s;
  return null;
}

export const otpauthUrl = (secret: string, email: string) =>
  `otpauth://totp/NUMORA:${encodeURIComponent(email)}?secret=${secret}&issuer=NUMORA&digits=6&period=30`;

/** Kode pemulihan: 8 kode sekali pakai berformat xxxxx-xxxxx, disimpan hanya sebagai hash. */
export const isRecoveryCode = (c: string) => /^[a-f0-9]{5}-[a-f0-9]{5}$/i.test(c.trim());
export const hashRecovery = (c: string) => createHash("sha256").update(`recovery:${c.trim().toLowerCase()}`).digest("hex");
export function newRecoveryCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const h = randomBytes(5).toString("hex");
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
}

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET belum diatur");
  return createHash("sha256").update(`mfa:${s}`).digest();
}

/** Rahasia TOTP disimpan terenkripsi (AES-256-GCM): iv.tag.data dalam base64. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string) {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
