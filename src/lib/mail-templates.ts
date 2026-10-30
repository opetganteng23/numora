import type { MailMessage } from "./mailer";

type Template = Omit<MailMessage, "to">;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export function inviteMail(p: { name: string; tenantName: string; link: string; expiresAt: Date }): Template {
  const exp = p.expiresAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  return {
    subject: `Undangan bergabung di NUMORA - ${p.tenantName}`,
    text: `Halo ${p.name},\n\nAnda diundang ke NUMORA (${p.tenantName}). Buat password lewat tautan berikut (berlaku sampai ${exp} WIB):\n${p.link}\n\nAbaikan email ini bila Anda tidak merasa diundang.`,
    html: `<p>Halo ${esc(p.name)},</p><p>Anda diundang ke <b>NUMORA</b> (${esc(p.tenantName)}).</p><p><a href="${esc(p.link)}">Buat password &amp; aktifkan akun</a><br/>Berlaku sampai ${esc(exp)} WIB.</p><p>Abaikan email ini bila Anda tidak merasa diundang.</p>`,
  };
}

export function pendingMail(p: { typeName: string; subject: string; requester: string }): Template {
  const link = `${appUrl()}/dashboard`;
  return {
    subject: `[NUMORA] Pengajuan nomor ${p.typeName} menunggu persetujuan`,
    text: `${p.requester} mengajukan nomor ${p.typeName}.\nPerihal: ${p.subject}\n\nBuka: ${link}`,
    html: `<p><b>${esc(p.requester)}</b> mengajukan nomor <b>${esc(p.typeName)}</b>.</p><p>Perihal: ${esc(p.subject)}</p><p><a href="${esc(link)}">Buka NUMORA</a></p>`,
  };
}

export function decisionMail(p: {
  decision: "approved" | "rejected";
  typeName: string;
  subject: string;
  number?: string;
  reason?: string;
}): Template {
  if (p.decision === "approved") {
    return {
      subject: `[NUMORA] Nomor surat terbit: ${p.number}`,
      text: `Pengajuan nomor ${p.typeName} disetujui.\nNomor: ${p.number}\nPerihal: ${p.subject}`,
      html: `<p>Pengajuan nomor <b>${esc(p.typeName)}</b> disetujui.</p><p style="font-size:18px"><b>${esc(p.number ?? "")}</b></p><p>Perihal: ${esc(p.subject)}</p>`,
    };
  }
  return {
    subject: `[NUMORA] Pengajuan nomor ${p.typeName} ditolak`,
    text: `Pengajuan nomor ${p.typeName} ditolak.\nPerihal: ${p.subject}\nAlasan: ${p.reason ?? "-"}`,
    html: `<p>Pengajuan nomor <b>${esc(p.typeName)}</b> ditolak.</p><p>Perihal: ${esc(p.subject)}</p><p>Alasan: ${esc(p.reason ?? "-")}</p>`,
  };
}

export function resetMail(p: { name: string; link: string; expiresAt: Date }): Template {
  const exp = p.expiresAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  return {
    subject: "Atur ulang password NUMORA",
    text: `Halo ${p.name},\n\nKami menerima permintaan atur ulang password. Buka tautan berikut (berlaku sampai ${exp} WIB):\n${p.link}\n\nAbaikan email ini bila Anda tidak memintanya.`,
    html: `<p>Halo ${esc(p.name)},</p><p>Kami menerima permintaan atur ulang password NUMORA.</p><p><a href="${esc(p.link)}">Atur ulang password</a><br/>Berlaku sampai ${esc(exp)} WIB.</p><p>Abaikan email ini bila Anda tidak memintanya.</p>`,
  };
}
