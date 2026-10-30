import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { CountUp, Reveal, Typer } from "@/components/Motion";

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const features: { t: string; d: string; i: ReactNode }[] = [
  {
    t: "Nomor unik tanpa bolong",
    d: "Nomor terbit atomik saat persetujuan dalam satu transaksi database. Penolakan tidak meninggalkan celah urutan.",
    i: svg(<><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></>),
  },
  {
    t: "Format fleksibel",
    d: "Atur pola per jenis surat: urut, jenis, unit, bulan romawi, dan tahun, dengan reset tahunan, bulanan, atau tanpa reset.",
    i: svg(<><path d="M8 4 3 12l5 8M16 4l5 8-5 8" /></>),
  },
  {
    t: "Multi instansi",
    d: "Data setiap instansi terisolasi penuh, lengkap dengan unit kerja dan peran admin, admin unit, staf, serta auditor.",
    i: svg(<><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>),
  },
  {
    t: "Persetujuan terarah",
    d: "Approver ditentukan per jenis surat. Pemohon langsung mendapat email saat pengajuan disetujui atau ditolak.",
    i: svg(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>),
  },
  {
    t: "Jejak audit lengkap",
    d: "Setiap pengajuan, persetujuan, dan pembatalan tercatat. Nomor yang dibatalkan tidak pernah dipakai ulang.",
    i: svg(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></>),
  },
  {
    t: "Aman secara default",
    d: "Sesi httpOnly, penguncian akun saat brute force, undangan sekali pakai, dan hak akses dibaca ulang dari database.",
    i: svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  },
];

const steps = [
  { t: "Ajukan", d: "Staf mengisi perihal, tujuan, dan tanggal surat. Pada tahap ini belum ada nomor yang terpakai." },
  { t: "Setujui", d: "Approver menyetujui, lalu nomor terbit otomatis sesuai format instansi Anda." },
  { t: "Lacak", d: "Cari, filter, dan audit semua nomor. Pembatalan tercatat tanpa menghapus jejak." },
];

const stats: { to: number; suffix: string; label: string }[] = [
  { to: 100, suffix: "%", label: "Nomor unik per instansi" },
  { to: 0, suffix: "", label: "Nomor bolong akibat penolakan" },
  { to: 5, suffix: "", label: "Peran pengguna terpisah" },
  { to: 6, suffix: "", label: "Token format nomor" },
];

const tokens = ["{urut}", "{jenis}", "{unit}", "{bulan}", "{bulan_romawi}", "{tahun}", "012/MOU/LEGAL/X/2026", "045/SK/IV/2026", "007/SKU/HRD/2026"];

const samples = ["012/MOU/LEGAL/X/2026", "045/SK/IV/2026", "007/SKU/HRD/2026", "103/SPK/KEU/2026"];

export const dynamic = "force-dynamic";

export default function Home() {
  const open = process.env.REGISTRATION_OPEN === "1";
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Brand />
          <nav>
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara kerja</a>
            {open && (
              <Link className="btn btn-sm btn-ghost" href="/register">
                Daftar
              </Link>
            )}
            <Link className="btn btn-sm" href="/login">
              Masuk
            </Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="wrap">
          <div>
            <Reveal>
              <span className="eyebrow">
                <i /> Numbering, Simplified
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1>
                Penomoran surat resmi yang <span className="grad">rapi, unik, dan terlacak</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="lead">
                NUMORA memusatkan penerbitan nomor surat untuk seluruh unit instansi Anda, lengkap dengan alur persetujuan dan jejak audit.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="cta">
                <Link className="btn" href="/login">
                  Mulai gunakan
                </Link>
                <a className="btn btn-ghost" href="#fitur">
                  Lihat fitur
                </a>
              </div>
            </Reveal>
          </div>

          <div className="stage">
            <div className="ring r1" />
            <div className="ring r2" />
            <div className="chip c1">
              Persetujuan<small>Approver per jenis surat</small>
            </div>
            <div className="card num-card">
              <Image className="logo" src="/logo-ailo.png" alt="AILO" width={112} height={112} priority />
              <div className="label">Nomor surat terbit</div>
              <div className="num">
                <Typer items={samples} />
              </div>
              <span className="badge">Disetujui</span>
            </div>
            <div className="chip c2">
              Jejak audit<small>Semua aksi tercatat</small>
            </div>
          </div>
        </div>
      </section>

      <section className="stats">
        <div className="wrap">
          <div className="grid4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
                <div className="card stat">
                  <CountUp to={s.to} suffix={s.suffix} />
                  <span>{s.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="track">
          {[...tokens, ...tokens].map((t, i) => (
            <span key={i} className={`pill${t.includes("/") ? " o" : ""}`}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <section className="block" id="fitur">
        <div className="wrap">
          <Reveal>
            <h2>Dirancang untuk keandalan</h2>
            <p className="sub">Semua yang dibutuhkan instansi untuk menerbitkan nomor surat secara tertib.</p>
          </Reveal>
          <div className="grid3">
            {features.map((f, i) => (
              <Reveal key={f.t} delay={(i % 3) * 110}>
                <div className="feature">
                  <div className="icon">{f.i}</div>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="block alt" id="cara-kerja">
        <div className="wrap">
          <Reveal>
            <h2>Cara kerja</h2>
            <p className="sub">Tiga langkah dari pengajuan sampai nomor tercatat.</p>
          </Reveal>
          <div className="grid3 steps">
            {steps.map((s, i) => (
              <Reveal key={s.t} delay={i * 140}>
                <div className="card step">
                  <div className="n">{i + 1}</div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <Reveal>
            <div className="card cta-band">
              <h2>Siap menertibkan penomoran surat Anda?</h2>
              <p>{open ? "Masuk dengan akun dari administrator, atau daftarkan instansi Anda sekarang." : "Masuk dengan akun dari administrator instansi Anda."}</p>
              <div className="cta" style={{ justifyContent: "center" }}>
                <Link className="btn" href="/login">
                  Masuk ke NUMORA
                </Link>
                {open && (
                  <Link className="btn btn-ghost" href="/register">
                    Daftarkan instansi
                  </Link>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="site">
        <div className="wrap">
          <span>&copy; {new Date().getFullYear()} NUMORA</span>
          <span>AILO | Telkom University&apos;s Center of Excellence</span>
        </div>
      </footer>
    </>
  );
}
