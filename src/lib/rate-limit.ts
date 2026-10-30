import type { NextRequest } from "next/server";
import { AppError } from "./errors";

interface Rule {
  /** Nama bucket, mis. "login". */
  key: string;
  limit: number;
  windowMs: number;
}

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

/** IP klien dari proxy (Caddy mengisi X-Forwarded-For). */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Pembatas laju per IP, di memori proses. Cukup untuk satu instance PM2;
 * bila nanti memakai banyak instance, pindahkan ke penyimpanan bersama atau edge.
 */
export function rateLimit(req: NextRequest, rule: Rule): void {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
  }
  const id = `${rule.key}:${clientIp(req)}`;
  const recent = (hits.get(id) ?? []).filter((t) => now - t < rule.windowMs);
  if (recent.length >= rule.limit) {
    hits.set(id, recent);
    const wait = Math.ceil((rule.windowMs - (now - recent[0])) / 1000);
    throw new AppError(429, `Terlalu banyak permintaan. Coba lagi sekitar ${wait} detik lagi.`, "RATE_LIMITED");
  }
  recent.push(now);
  hits.set(id, recent);
}
