/**
 * Buat instansi + admin pertamanya tanpa lewat halaman /register.
 *
 *   SEED_TENANT_NAME="AILO" SEED_TENANT_SLUG=ailo SEED_NAME="..." SEED_EMAIL=... SEED_PASSWORD=... \
 *     npx tsx --env-file=.env scripts/seed-tenant.ts
 *
 * Idempoten: instansi/akun yang sudah ada tidak ditimpa. Password tidak pernah dicetak.
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { AuditLog, Tenant, User } from "../src/models";

const need = (k: string) => {
  const v = process.env[k]?.trim();
  if (!v) throw new Error(`${k} wajib diisi`);
  return v;
};

async function main() {
  const tenantName = need("SEED_TENANT_NAME");
  const slug = need("SEED_TENANT_SLUG").toLowerCase();
  const name = need("SEED_NAME");
  const email = need("SEED_EMAIL").toLowerCase();
  const password = need("SEED_PASSWORD");
  if (password.length < 10) throw new Error("SEED_PASSWORD minimal 10 karakter");

  await connectDB();

  let tenant = await Tenant.findOne({ slug });
  if (tenant) console.log(`instansi sudah ada: ${tenant.name} (${slug})`);
  else {
    tenant = await Tenant.create({ name: tenantName, slug });
    console.log(`instansi dibuat: ${tenantName} (${slug})`);
  }

  const existing = await User.findOne({ email }).select("tenantId role").lean();
  if (existing) {
    if (String(existing.tenantId) !== String(tenant._id)) throw new Error(`${email} sudah terdaftar di instansi lain`);
    console.log(`akun sudah ada: ${email} (${existing.role}); password tidak diubah`);
  } else {
    const user = await User.create({
      tenantId: tenant._id,
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "tenant_admin",
      status: "active",
    });
    await AuditLog.create({ tenantId: tenant._id, actorId: user._id, action: "tenant.seed", entityType: "Tenant", entityId: tenant._id });
    console.log(`akun dibuat: ${email} (tenant_admin)`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
