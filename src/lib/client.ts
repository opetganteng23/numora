/* eslint-disable @typescript-eslint/no-explicit-any */
/** Helper fetch untuk komponen klien. Melempar Error berisi pesan yang siap tampil. */
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown; method?: string }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
  if (!res.ok) {
    const field = data?.issues?.fieldErrors ? (Object.values(data.issues.fieldErrors).flat()[0] as string | undefined) : undefined;
    throw new Error(field ?? data?.error ?? "Terjadi kesalahan");
  }
  return data as T;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  tenant_admin: "Admin Instansi",
  unit_admin: "Admin Unit",
  staff: "Staf",
  auditor: "Auditor",
};

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-";

export const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) : "-";
