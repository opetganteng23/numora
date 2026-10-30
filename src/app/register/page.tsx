import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import RegisterForm from "./form";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  if (process.env.REGISTRATION_OPEN !== "1") {
    return (
      <AuthShell title="Pendaftaran ditutup" subtitle="Instansi baru dibuat oleh administrator.">
        <div className="card">
          <p style={{ margin: 0 }}>Hubungi administrator NUMORA untuk mendaftarkan instansi Anda, atau minta undangan dari admin instansi Anda.</p>
        </div>
        <p className="muted" style={{ fontSize: 14, marginTop: 20 }}>
          <Link href="/login">Kembali ke halaman masuk</Link>
        </p>
      </AuthShell>
    );
  }
  return <RegisterForm />;
}
