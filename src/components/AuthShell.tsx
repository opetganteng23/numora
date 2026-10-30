import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Kerangka halaman autentikasi: logo, judul, dan isi. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="auth">
      <Link href="/">
        <Image className="logo" src="/logo-ailo.png" alt="AILO, Telkom University's Center of Excellence" width={96} height={96} priority />
      </Link>
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
      {children}
    </main>
  );
}
