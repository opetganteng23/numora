import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>NUMORA</h1>
      <p className="muted">Numbering, Simplified.</p>
      <p>Sistem penomoran surat terpusat: nomor unik, sesuai format, lengkap dengan persetujuan dan jejak audit.</p>
      <Link className="btn" href="/login">
        Masuk
      </Link>
    </main>
  );
}
