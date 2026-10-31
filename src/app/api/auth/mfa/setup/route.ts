import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { handle, json } from "@/lib/http";
import { encryptSecret, newSecret, otpauthUrl } from "@/lib/totp";
import { User } from "@/models";

/** Mulai pendaftaran: buat rahasia baru (belum aktif sampai kode pertama dikonfirmasi). */
export const POST = handle(async () => {
  const me = await requireUser();
  const user = await User.findById(me.userId).select("email mfaEnabled");
  if (!user) throw new AppError(404, "Pengguna tidak ditemukan");
  if (user.mfaEnabled) throw new AppError(409, "MFA sudah aktif");
  const secret = newSecret();
  await User.updateOne({ _id: user._id }, { $set: { mfaSecret: encryptSecret(secret) } });
  const qr = await QRCode.toString(otpauthUrl(secret, user.email), { type: "svg", margin: 1, width: 180 });
  return json({ secret, qr });
});
