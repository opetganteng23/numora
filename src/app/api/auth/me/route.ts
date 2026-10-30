import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ user });
});
