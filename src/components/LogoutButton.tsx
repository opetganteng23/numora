"use client";

import { useState } from "react";

/** Keluar lalu langsung ke landing page. */
export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.replace("/");
    }
  }

  return (
    <button type="button" className="btn-sm btn-ghost" onClick={logout} disabled={busy}>
      {busy ? "Keluar..." : "Keluar"}
    </button>
  );
}
