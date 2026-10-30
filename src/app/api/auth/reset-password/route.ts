import { z } from "zod";
import { handle, json, parseBody } from "@/lib/http";
import { resetPassword } from "@/services/password-reset";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(10, "Password minimal 10 karakter").max(200),
});

export const POST = handle(async (req) => {
  const { token, password } = await parseBody(req, schema);
  await resetPassword(token, password);
  return json({ ok: true });
});
