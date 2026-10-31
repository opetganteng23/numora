"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function MarkRead() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-sm btn-ghost"
      onClick={async () => {
        await api("/api/notifications", { json: {} });
        router.refresh();
      }}
    >
      Tandai semua dibaca
    </button>
  );
}
