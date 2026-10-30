import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle, json, parseBody } from "@/lib/http";
import { Tenant } from "@/models";
import { audit } from "@/services/audit";
import { inviteUser } from "@/services/invitations";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, "Slug: huruf kecil/angka/strip"),
  timeZone: z.string().default("Asia/Jakarta"),
  adminEmail: z.string().email(),
  adminName: z.string().trim().min(2).max(120),
});

export const GET = handle(async () => {
  await requireUser(["super_admin"]);
  const items = await Tenant.find().sort({ createdAt: -1 }).lean();
  return json({ items });
});

/** Super admin membuat instansi baru + mengundang admin pertamanya. */
export const POST = handle(async (req) => {
  const actor = await requireUser(["super_admin"]);
  const body = await parseBody(req, schema);

  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: body.timeZone });
  } catch {
    return json({ error: "Zona waktu tidak valid" }, 422);
  }

  const tenant = await Tenant.create({ name: body.name, slug: body.slug, timeZone: body.timeZone });
  await audit({ tenantId: tenant._id, actorId: actor.userId, action: "tenant.create", entityType: "Tenant", entityId: tenant._id });

  const invite = await inviteUser({
    tenantId: String(tenant._id),
    invitedBy: actor.userId,
    email: body.adminEmail,
    name: body.adminName,
    role: "tenant_admin",
  });
  return json({ tenant: tenant.toObject(), invite }, 201);
});
