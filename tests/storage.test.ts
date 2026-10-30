import { describe, expect, it } from "vitest";
import { detectType, sha256 } from "@/lib/storage";

describe("storage", () => {
  it("menerima PDF asli dan menolak ekstensi yang isinya tidak cocok", () => {
    expect(detectType("a.pdf", Buffer.from("%PDF-1.7 x"))?.mime).toBe("application/pdf");
    expect(detectType("a.pdf", Buffer.from("MZ executable"))).toBeNull();
    expect(detectType("a.exe", Buffer.from("%PDF-1.7"))).toBeNull();
  });
  it("hash SHA-256 stabil", () => {
    expect(sha256(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
