import AcceptForm from "./form";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main>
      <h1>Aktifkan akun</h1>
      {token ? <AcceptForm token={token} /> : <p className="error">Tautan undangan tidak valid.</p>}
    </main>
  );
}
