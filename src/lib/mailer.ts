import nodemailer, { type Transporter } from "nodemailer";

export interface MailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

/**
 * Satu-satunya pintu keluar email. Untuk pindah dari Gmail ke Resend / SES /
 * SMTP domain sendiri, cukup tambah provider baru di sini; kode lain tidak berubah.
 */
export interface MailProvider {
  send(msg: MailMessage): Promise<void>;
}

class GmailProvider implements MailProvider {
  private transporter: Transporter;
  constructor(
    user: string,
    pass: string,
    private from: string,
  ) {
    this.transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  }
  async send(msg: MailMessage) {
    await this.transporter.sendMail({ from: this.from, ...msg });
  }
}

class ConsoleProvider implements MailProvider {
  async send(msg: MailMessage) {
    console.log(`[mail:console] to=${[msg.to].flat().join(",")} subject="${msg.subject}"\n${msg.text}\n`);
  }
}

let provider: MailProvider | null = null;

function getProvider(): MailProvider {
  if (provider) return provider;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (process.env.MAIL_DISABLED === "1" || !user || !pass) {
    provider = new ConsoleProvider();
  } else {
    provider = new GmailProvider(user, pass, process.env.MAIL_FROM || `NUMORA <${user}>`);
  }
  return provider;
}

/** Tidak pernah melempar error: kegagalan email tidak boleh menggagalkan proses bisnis. */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  try {
    await getProvider().send(msg);
    return true;
  } catch (e) {
    console.error("[mail] gagal mengirim:", e);
    return false;
  }
}
