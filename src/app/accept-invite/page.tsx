import { AuthShell } from "@/components/AuthShell";
import AcceptForm from "./form";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Aktifkan akun">
      {token ? <AcceptForm token={token} /> : <p className="error">Tautan undangan tidak valid.</p>}
    </AuthShell>
  );
}
