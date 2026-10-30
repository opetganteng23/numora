import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import ResetForm from "./form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Atur ulang password">
      {token ? (
        <ResetForm token={token} />
      ) : (
        <p className="error">
          Tautan tidak valid. <Link href="/forgot-password">Minta tautan baru</Link>
        </p>
      )}
    </AuthShell>
  );
}
