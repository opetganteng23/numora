import Image from "next/image";
import Link from "next/link";

export function Brand({ size = 44 }: { size?: number }) {
  return (
    <Link href="/" className="brand">
      <Image src="/logo-ailo.png" alt="AILO, Telkom University's Center of Excellence" width={size} height={size} priority />
      <span>NUMORA</span>
    </Link>
  );
}
