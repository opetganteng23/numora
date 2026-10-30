import { z } from "zod";
import { AppError } from "@/lib/errors";
import { handle, json, parseBody } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { Tenant, User } from "@/models";
import { audit } from "@/services/audit";

const schema = z.object({
  tenantName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(200),
  password: z.string().min(10, "Password minimal 10 karakter").max(200),
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "instansi";

/** Pendaftaran instansi baru: membuat Tenant + tenant_admin pertamanya. Aktif bila REGISTRATION_OPEN=1. */
export const POST = handle(async (req) => {
  if (process.env.REGISTRATION_OPEN !== "1") throw new AppError(403, "Pendaftaran mandiri sedang ditutup. Hubungi administrator.");
  const body = await parseBody(req, schema);
  const email = body.email.toLowerCase().trim();
  if (await User.exists({ email })) throw new AppError(409, "Email ini sudah terdaftar");

  const base = slugify(body.tenantName);
  let tenant = null;
  for (let i = 0; i < 5 && !tenant; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      tenant = await Tenant.create({ name: body.tenantName, slug });
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
  }
  if (!tenant) throw new AppError(409, "Gagal membuat instansi, coba lagi");

  try {
    const user = await User.create({
      tenantId: tenant._id,
      name: body.name,
      email,
      passwordHash: await hashPassword(body.password),
      role: "tenant_admin",
      status: "active",
    });
    await audit({ tenantId: tenant._id, actorId: user._id, action: "tenant.register", entityType: "Tenant", entityId: tenant._id });
    await createSession(String(user._id));
  } catch (e) {
    await Tenant.deleteOne({ _id: tenant._id }); // jangan tinggalkan instansi tanpa admin
    throw e;
  }
  return json({ ok: true }, 201);
});
