import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { connectDB } from "./db";
import { AppError, isDuplicateKey } from "./errors";

type RouteCtx = { params: Promise<Record<string, string>> };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Pertahanan CSRF dasar: request tulis dari browser harus berasal dari host yang sama. */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // klien non-browser (cookie sesi tidak ikut terkirim lintas situs)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    /* origin tidak valid */
  }
  if (originHost !== host) throw new AppError(403, "Origin tidak diizinkan");
}

export function toErrorResponse(e: unknown) {
  if (e instanceof AppError) return json({ error: e.message, code: e.code }, e.status);
  if (e instanceof ZodError) return json({ error: "Input tidak valid", issues: e.flatten() }, 400);
  if (isDuplicateKey(e)) return json({ error: "Data duplikat, silakan coba lagi", code: "DUPLICATE" }, 409);
  console.error("[api] error tak terduga:", e);
  return json({ error: "Terjadi kesalahan pada server" }, 500);
}

/** Bungkus route handler: cek origin, konek DB, tangkap & petakan error. */
export function handle(fn: (req: NextRequest, ctx: RouteCtx) => Promise<Response>) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<Response> => {
    try {
      assertSameOrigin(req);
      await connectDB();
      return await fn(req, ctx);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export async function parseBody<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, "Body harus berupa JSON yang valid");
  }
  return schema.parse(body);
}
