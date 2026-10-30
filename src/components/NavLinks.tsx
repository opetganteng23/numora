"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // Item aktif = yang href-nya paling panjang dan cocok dengan awalan path.
  const best = items
    .filter((i) => path === i.href || path.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav className="side-nav">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={best?.href === i.href ? "active" : ""}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
