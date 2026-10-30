import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { LogoutButton } from "@/components/LogoutButton";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/client";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin") redirect("/admin");

  const items: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];
  if (user.role !== "auditor") items.push({ href: "/letters/new", label: "Ajukan Nomor" });
  items.push({ href: "/letters", label: "Registri Surat" });
  if (user.role !== "auditor") items.push({ href: "/approvals", label: "Persetujuan" });
  if (user.role === "tenant_admin") items.push({ href: "/team", label: "Pengaturan" });
  if (user.role === "tenant_admin" || user.role === "auditor") items.push({ href: "/audit", label: "Jejak Audit" });

  items.push({ href: "/profile", label: "Profil" });

  return (
    <div className="app">
      <aside className="side">
        <Brand />
        <NavLinks items={items} />
      </aside>
      <div className="app-main">
        <header className="app-top">
          <span className="muted who">
            {user.name} &middot; {ROLE_LABEL[user.role] ?? user.role}
          </span>
          <LogoutButton />
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
