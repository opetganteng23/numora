import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { User } from "@/models";

export const GET = handle(async () => {
  const me = await requireUser();
  const user = await User.findById(me.userId).select("mfaEnabled").lean();
  return json({ enabled: !!user?.mfaEnabled });
});
