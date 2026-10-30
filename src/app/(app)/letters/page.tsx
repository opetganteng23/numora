import Link from "next/link";
import { LetterTable } from "@/components/LetterTable";
import { requireTenantUser } from "@/lib/auth";

export default async function RegistryPage() {
  const ctx = await requireTenantUser();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Registri Surat</h1>
          <p className="muted">Semua nomor surat yang pernah diajukan, termasuk yang ditolak dan dibatalkan.</p>
        </div>
        {ctx.role !== "auditor" && (
          <Link className="btn" href="/letters/new">
            Ajukan nomor
          </Link>
        )}
      </div>
      <LetterTable mode="registry" />
    </>
  );
}
