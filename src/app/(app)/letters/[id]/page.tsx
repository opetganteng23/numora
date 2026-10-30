import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsCard } from "@/components/DocumentsCard";
import { requireTenantUser } from "@/lib/auth";
import { ACTION_LABEL, fmtDate, fmtDateTime, STATUS_LABEL } from "@/lib/client";
import { getLetter } from "@/services/letters";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-row">
      <span className="muted">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export default async function LetterDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantUser();
  let data;
  try {
    data = await getLetter(ctx, id);
  } catch {
    notFound();
  }
  const { letter: l, names, history } = data;
  const nm = (x?: unknown) => (x ? names[String(x)] ?? "-" : "-");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small">
            <Link href="/letters">Registri Surat</Link>
          </p>
          <h1 className="mono-h">{l.number?.full ?? "Belum bernomor"}</h1>
          <p className="muted">{l.subject}</p>
        </div>
        <span className={`st ${l.status}`}>{STATUS_LABEL[l.status]}</span>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Data surat</h3>
          <Row label="Jenis surat">{l.typeName}</Row>
          <Row label="Kategori">{l.category ?? "-"}</Row>
          <Row label="Perihal">{l.subject}</Row>
          <Row label="Ditujukan kepada">{l.recipient}</Row>
          <Row label="Tanggal surat">{fmtDate(l.letterDate)}</Row>
          <Row label="Pemohon">{l.requesterName}</Row>
          {l.number && (
            <>
              <Row label="Nomor urut">{l.number.seq}</Row>
              <Row label="Periode">{l.number.period}</Row>
              <Row label="Terbit">{fmtDateTime(l.number.issuedAt)}</Row>
            </>
          )}
          {l.approvedBy && <Row label="Disetujui oleh">{nm(l.approvedBy)}</Row>}
          {l.rejectedBy && (
            <Row label="Ditolak oleh">
              {nm(l.rejectedBy)}
              {l.rejectReason ? `: ${l.rejectReason}` : ""}
            </Row>
          )}
          {l.cancelRequest && (
            <Row label="Pembatalan diajukan">
              {nm(l.cancelRequest.by)}: {l.cancelRequest.reason}
            </Row>
          )}
          {l.cancelledBy && (
            <Row label="Dibatalkan oleh">
              {nm(l.cancelledBy)}
              {l.cancelReason ? `: ${l.cancelReason}` : ""}
            </Row>
          )}
          {l.legacy?.note && <Row label="Catatan impor">{l.legacy.note}</Row>}
          {l.legacy?.creator && <Row label="Pembuat di sheet lama">{l.legacy.creator}</Row>}
        </div>

        <div className="card">
          <h3>Riwayat</h3>
          {history.length === 0 ? (
            <p className="muted">Belum ada catatan riwayat untuk surat ini.</p>
          ) : (
            <ol className="timeline">
              {history.map((h, i) => (
                <li key={i}>
                  <b>{ACTION_LABEL[h.action] ?? h.action}</b>
                  <span className="muted small">
                    {h.actorId ? names[h.actorId] ?? "-" : "-"} &middot; {fmtDateTime(h.at)}
                  </span>
                  {h.meta && typeof (h.meta as { reason?: string }).reason === "string" && <span className="small">Alasan: {(h.meta as { reason: string }).reason}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {l.status === "approved" && (
        <DocumentsCard
          letterId={String(l._id)}
          canUpload={ctx.role !== "auditor"}
          docs={(l.documents ?? []).map((d) => ({
            version: d.version,
            fileName: d.fileName,
            size: d.size,
            sha256: d.sha256,
            uploadedAt: new Date(d.uploadedAt).toISOString(),
            uploaderName: nm(d.uploadedBy),
          }))}
        />
      )}
    </>
  );
}
