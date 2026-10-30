import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Placeholder: membuktikan sesi dan peran bekerja. UI lengkap dibangun di atas API /api/*. */
export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Brand />
          <nav>
            <span className="muted" style={{ fontSize: 14 }}>
              {user.name} &middot; {user.role}
            </span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main>
        <h1>Dashboard</h1>
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>Antarmuka belum dibuat. Semua fungsi sudah tersedia lewat API (lihat README).</p>
        </div>
      </main>
    </>
  );
}
