import { z } from "zod";
import { handle, json, parseBody } from "@/lib/http";
import { requestPasswordReset } from "@/services/password-reset";

const schema = z.object({ email: z.string().email().max(200) });

export const POST = handle(async (req) => {
  const { email } = await parseBody(req, schema);
  try {
    await requestPasswordReset(email);
  } catch (e) {
    console.error("[forgot-password] gagal:", e); // jangan bocorkan ke klien
  }
  return json({ ok: true });
});
