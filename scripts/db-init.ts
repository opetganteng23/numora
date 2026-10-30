/**
 * Jalankan SEKALI per environment (dan setiap deploy yang mengubah index):
 *   npm run db:init
 * - membuat koleksi + index (transaksi butuh koleksi sudah ada)
 * - membuat akun Super Admin dari SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD bila belum ada
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { AuditLog, Counter, Invitation, Letter, LetterType, PasswordReset, Tenant, Unit, User } from "../src/models";

async function main() {
  await connectDB();

  for (const model of [Tenant, User, Unit, LetterType, Counter, Letter, AuditLog, Invitation, PasswordReset]) {
    await model.createCollection().catch(() => undefined); // sudah ada = aman
    await model.syncIndexes();
    console.log(`index OK: ${model.modelName}`);
  }

  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 10) throw new Error("SUPERADMIN_PASSWORD minimal 10 karakter");
    const exists = await User.exists({ email });
    if (exists) {
      console.log(`super admin sudah ada: ${email}`);
    } else {
      await User.create({
        tenantId: null,
        name: "Super Admin",
        email,
        passwordHash: await hashPassword(password),
        role: "super_admin",
        status: "active",
      });
      console.log(`super admin dibuat: ${email}`);
    }
  } else {
    console.log("SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD tidak diisi: lewati pembuatan super admin");
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
