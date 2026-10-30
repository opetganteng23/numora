import { z } from "zod";
import { handle, json, parseBody } from "@/lib/http";
import { createSession } from "@/lib/session";
import { acceptInvitation } from "@/services/invitations";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(10, "Password minimal 10 karakter").max(200),
});

export const POST = handle(async (req) => {
  const { token, password } = await parseBody(req, schema);
  const userId = await acceptInvitation(token, password);
  await createSession(String(userId));
  return json({ ok: true }, 201);
});
