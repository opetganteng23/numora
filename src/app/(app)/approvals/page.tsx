import { LetterTable } from "@/components/LetterTable";

export default function ApprovalsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Persetujuan</h1>
          <p className="muted">Pengajuan yang menunggu keputusan Anda. Nomor terbit saat Anda menyetujui.</p>
        </div>
      </div>
      <LetterTable mode="approvals" />
    </>
  );
}
