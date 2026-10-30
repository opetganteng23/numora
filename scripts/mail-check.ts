/**
 * Cek kredensial email tanpa mengirim apa pun, atau kirim satu email uji.
 *   npx tsx --env-file=.env scripts/mail-check.ts              (hanya verifikasi login SMTP)
 *   npx tsx --env-file=.env scripts/mail-check.ts --send=a@b.c (kirim email uji ke alamat itu)
 */
import nodemailer from "nodemailer";

async function main() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (process.env.MAIL_DISABLED === "1") console.log("PERINGATAN: MAIL_DISABLED=1, aplikasi tidak mengirim email");
  if (!user || !pass) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD belum diisi");
  const t = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await t.verify();
  console.log(`Login SMTP OK untuk ${user}`);
  const to = process.argv.find((a) => a.startsWith("--send="))?.split("=")[1];
  if (to) {
    await t.sendMail({
      from: process.env.MAIL_FROM || `NUMORA <${user}>`,
      to,
      subject: "[NUMORA] Email uji",
      text: "Ini email uji dari server NUMORA. Bila Anda menerimanya, pengiriman email berfungsi.",
    });
    console.log(`Email uji terkirim ke ${to}`);
  }
}

main().catch((e) => {
  console.error("GAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
