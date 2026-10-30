import { z } from "zod";
import { requireTenantUser } from "@/lib/auth";
import { handle, json, parseBody } from "@/lib/http";
import { createLetter, listLetters } from "@/services/letters";

const oidStr = z.string().regex(/^[a-f\d]{24}$/i, "ID tidak valid");

const createSchema = z.object({
  letterTypeId: oidStr,
  unitId: oidStr.nullish(),
  subject: z.string().trim().min(1).max(300),
  recipient: z.string().trim().min(1).max(300),
  letterDate: z.coerce.date(),
  category: z.string().trim().max(60).optional(),
});

const listSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  letterTypeId: oidStr.optional(),
  category: z.string().trim().max(60).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handle(async (req) => {
  const ctx = await requireTenantUser();
  const query = listSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return json(await listLetters(ctx, query));
});

export const POST = handle(async (req) => {
  const ctx = await requireTenantUser();
  const body = await parseBody(req, createSchema);
  return json({ letter: await createLetter(ctx, body) }, 201);
});
