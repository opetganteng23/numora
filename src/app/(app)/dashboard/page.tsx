import Link from "next/link";
import { requireTenantUser } from "@/lib/auth";
import { fmtDate, STATUS_LABEL } from "@/lib/client";
import { getDashboard } from "@/services/letters";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default async function Dashboard() {
  const ctx = await requireTenantUser();
  const d = await getDashboard(ctx);
  const maxMonth = Math.max(1, ...d.months);
  const maxCat = Math.max(1, ...d.categories.map((c) => c.count));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Ringkasan penomoran surat sesuai kewenangan Anda.</p>
        </div>
        {ctx.role !== "auditor" && (
          <Link className="btn" href="/letters/new">
            Ajukan nomor
          </Link>
        )}
      </div>

      <div className="grid4">
        <div className="card stat-card">
          <span className="muted">Nomor terbit</span>
          <b>{d.status.approved}</b>
        </div>
        <Link href="/approvals" className="card stat-card link-card">
          <span className="muted">Menunggu persetujuan</span>
          <b className={d.pending ? "warn" : ""}>{d.pending}</b>
        </Link>
        <div className="card stat-card">
          <span className="muted">Dibatalkan</span>
          <b>{d.status.cancelled}</b>
        </div>
        <div className="card stat-card">
          <span className="muted">Nomor terakhir</span>
          <b className="small">{d.lastNumber ?? "-"}</b>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Nomor terbit per bulan, {d.year}</h3>
          <div className="bars">
            {d.months.map((n, i) => (
              <div key={i} className="bar-col" title={`${MONTHS[i]}: ${n}`}>
                <span className="bar-n">{n || ""}</span>
                <div className="bar" style={{ height: `${(n / maxMonth) * 100}%` }} />
                <span className="bar-l">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Per kategori</h3>
          {d.categories.length === 0 ? (
            <p className="muted">Belum ada data.</p>
          ) : (
            <div className="hbars">
              {d.categories.map((c) => (
                <div key={c.name} className="hbar">
                  <div className="hbar-top">
                    <span>{c.name}</span>
                    <b>{c.count}</b>
                  </div>
                  <div className="hbar-track">
                    <div style={{ width: `${(c.count / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="row-between">
          <h3>Aktivitas terbaru</h3>
          <Link href="/letters">Lihat semua</Link>
        </div>
        {d.recent.length === 0 ? (
          <p className="muted">Belum ada surat.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Perihal</th>
                  <th>Pemohon</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((l) => (
                  <tr key={String(l._id)}>
                    <td className="mono">{l.number?.full ?? "belum ada"}</td>
                    <td>{l.subject}</td>
                    <td>{l.requesterName}</td>
                    <td>{fmtDate(l.letterDate)}</td>
                    <td>
                      <span className={`st ${l.status}`}>{STATUS_LABEL[l.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
