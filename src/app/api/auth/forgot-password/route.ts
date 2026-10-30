import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { handle, json, parseBody } from "@/lib/http";
import { requestPasswordReset } from "@/services/password-reset";

const schema = z.object({ email: z.string().email().max(200) });

export const POST = handle(async (req) => {
  rateLimit(req, { key: "forgot", limit: 5, windowMs: 900000 });
  const { email } = await parseBody(req, schema);
  try {
    await requestPasswordReset(email);
  } catch (e) {
    console.error("[forgot-password] gagal:", e); // jangan bocorkan ke klien
  }
  return json({ ok: true });
});
