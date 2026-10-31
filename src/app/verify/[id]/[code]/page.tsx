import { timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import { Brand } from "@/components/Brand";
import { HashChecker } from "@/components/HashChecker";
import { fmtDate, STATUS_LABEL } from "@/lib/client";
import { connectDB } from "@/lib/db";
import { verifyCode } from "@/lib/verify-code";
import { Letter, LetterType, Tenant } from "@/models";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verifikasi Surat | NUMORA", robots: { index: false } };

/** Halaman publik. Hanya menampilkan data minimum: tidak ada perihal, tujuan, atau nama orang. */
export default async function VerifyPage({ params }: { params: Promise<{ id: string; code: string }> }) {
  const { id, code } = await params;
  let letter = null;
  if (Types.ObjectId.isValid(id)) {
    const expected = Buffer.from(verifyCode(id));
    const given = Buffer.from(code);
    if (expected.length === given.length && timingSafeEqual(expected, given)) {
      await connectDB();
      letter = await Letter.findById(id).lean();
    }
  }
  const [tenant, type] = letter
    ? await Promise.all([Tenant.findById(letter.tenantId).select("name").lean(), LetterType.findById(letter.letterTypeId).select("name").lean()])
    : [null, null];
  const latest = letter?.documents?.length ? letter.documents.reduce((a, b) => (b.version > a.version ? b : a)) : null;
  const valid = letter?.status === "approved";

  return (
    <main style={{ maxWidth: 620, margin: "40px auto" }}>
      <Brand />
      {!letter || !letter.number ? (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>Surat tidak ditemukan</h2>
          <p className="muted">Kode verifikasi tidak cocok dengan surat mana pun yang bernomor di NUMORA.</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 24 }}>
          <p className={`flash ${valid ? "ok" : "bad"}`}>{valid ? "Nomor surat ini terdaftar dan sah." : `Nomor ini berstatus ${STATUS_LABEL[letter.status]}.`}</p>
          <h2 className="mono-h">{letter.number.full}</h2>
          <p className="muted">{tenant?.name}</p>
          <div className="detail-row"><span className="muted">Jenis surat</span><div>{type?.name}</div></div>
          <div className="detail-row"><span className="muted">Tanggal surat</span><div>{fmtDate(letter.letterDate)}</div></div>
          {latest ? (
            <>
              <div className="detail-row"><span className="muted">Dokumen final</span><div>Versi {latest.version}</div></div>
              <div className="detail-row"><span className="muted">SHA-256</span><div className="mono small" style={{ wordBreak: "break-all" }}>{latest.sha256}</div></div>
              <HashChecker expected={latest.sha256} />
            </>
          ) : (
            <p className="muted">Belum ada dokumen final yang diunggah untuk nomor ini.</p>
          )}
        </div>
      )}
    </main>
  );
}
