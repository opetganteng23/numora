import { decisionMail, pendingMail } from "@/lib/mail-templates";
import { sendMail } from "@/lib/mailer";
import { Letter, LetterType, Notification, User } from "@/models";

/** Semua fungsi di sini tidak pernah melempar error; dipanggil SETELAH transaksi commit. */

export async function notifyApprovers(letterId: string): Promise<void> {
  try {
    const letter = await Letter.findById(letterId).lean();
    if (!letter) return;
    const [type, requester] = await Promise.all([
      LetterType.findById(letter.letterTypeId).lean(),
      User.findById(letter.requesterId).select("name").lean(),
    ]);
    if (!type) return;

    // Approver jenis surat + tenant_admin
    const recipients = await User.find({
      tenantId: letter.tenantId,
      status: "active",
      $or: [{ _id: { $in: type.approverIds } }, { role: "tenant_admin" }],
    })
      .select("email")
      .lean();
    const to = [...new Set(recipients.map((r) => r.email))];
    if (!to.length) return;

    await Notification.insertMany(
      recipients.map((r) => ({
        tenantId: letter.tenantId,
        userId: r._id,
        type: "pending",
        letterId: letter._id,
        text: `${requester?.name ?? "Seseorang"} mengajukan nomor ${type.name}: ${letter.subject}`,
      })),
    );

    await sendMail({
      to,
      ...pendingMail({ typeName: type.name, subject: letter.subject, requester: requester?.name ?? "Seseorang" }),
    });
  } catch (e) {
    console.error("[notify] notifyApprovers gagal:", e);
  }
}

export async function notifyDecision(letterId: string): Promise<void> {
  try {
    const letter = await Letter.findById(letterId).lean();
    if (!letter || (letter.status !== "approved" && letter.status !== "rejected")) return;
    const [type, requester] = await Promise.all([
      LetterType.findById(letter.letterTypeId).lean(),
      User.findById(letter.requesterId).select("email").lean(),
    ]);
    if (!type || !requester) return;

    await Notification.create({
      tenantId: letter.tenantId,
      userId: letter.requesterId,
      type: letter.status,
      letterId: letter._id,
      text:
        letter.status === "approved"
          ? `Disetujui, nomor terbit ${letter.number?.full}: ${letter.subject}`
          : `Ditolak${letter.rejectReason ? ` (${letter.rejectReason})` : ""}: ${letter.subject}`,
    });
    await sendMail({
      to: requester.email,
      ...decisionMail({
        decision: letter.status,
        typeName: type.name,
        subject: letter.subject,
        number: letter.number?.full,
        reason: letter.rejectReason,
      }),
    });
  } catch (e) {
    console.error("[notify] notifyDecision gagal:", e);
  }
}
