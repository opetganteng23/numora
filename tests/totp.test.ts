import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, newSecret, verifyTotp } from "@/lib/totp";

// Vektor uji RFC 6238 (SHA-1), rahasia ASCII "12345678901234567890"
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it("cocok dengan vektor RFC 6238", () => {
    expect(verifyTotp(RFC_SECRET, "287082", 59_000)).toBe(1);
    expect(verifyTotp(RFC_SECRET, "081804", 1_111_111_109_000)).not.toBeNull();
  });
  it("menolak kode salah dan format tidak valid", () => {
    expect(verifyTotp(RFC_SECRET, "000000", 59_000)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", 59_000)).toBeNull();
  });
  it("enkripsi rahasia bolak-balik dan acak", () => {
    process.env.SESSION_SECRET = "x".repeat(40);
    const s = newSecret();
    const a = encryptSecret(s);
    expect(decryptSecret(a)).toBe(s);
    expect(encryptSecret(s)).not.toBe(a);
  });
});
