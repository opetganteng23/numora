import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

const req = (ip: string) => ({ headers: new Headers({ "x-forwarded-for": ip }) }) as unknown as NextRequest;

describe("rateLimit", () => {
  const rule = { key: "uji", limit: 3, windowMs: 60_000 };

  it("menolak permintaan setelah melewati batas dari IP yang sama", () => {
    const r = req("10.0.0.1");
    for (let i = 0; i < 3; i++) rateLimit(r, rule);
    expect(() => rateLimit(r, rule)).toThrowError(/Terlalu banyak/);
  });

  it("IP lain tidak terpengaruh", () => {
    for (let i = 0; i < 3; i++) rateLimit(req("10.0.0.2"), rule);
    expect(() => rateLimit(req("10.0.0.3"), rule)).not.toThrow();
  });

  it("bucket berbeda dihitung terpisah", () => {
    for (let i = 0; i < 3; i++) rateLimit(req("10.0.0.4"), rule);
    expect(() => rateLimit(req("10.0.0.4"), { ...rule, key: "lain" })).not.toThrow();
  });

  it("memakai alamat pertama X-Forwarded-For", () => {
    const r = req("10.0.0.5, 172.19.0.1");
    for (let i = 0; i < 3; i++) rateLimit(r, rule);
    expect(() => rateLimit(req("10.0.0.5"), rule)).toThrowError(/Terlalu banyak/);
  });
});
