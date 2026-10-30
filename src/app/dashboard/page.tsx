import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Placeholder: membuktikan sesi & peran bekerja. UI sebenarnya dibangun di atas API /api/*. */
export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main>
      <h1>Dashboard</h1>
      <p className="muted">
        {user.name} &middot; {user.role}
      </p>
      <div className="card">
        <p>Antarmuka belum dibuat. Semua fungsi sudah tersedia lewat API (lihat README).</p>
      </div>
    </main>
  );
}
