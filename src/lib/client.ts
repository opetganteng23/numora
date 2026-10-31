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

export const ACTION_LABEL: Record<string, string> = {
  "letter.create": "Mengajukan nomor",
  "letter.approve": "Menyetujui dan menerbitkan nomor",
  "letter.reject": "Menolak pengajuan",
  "letter.cancel_request": "Mengajukan pembatalan",
  "letter.cancel": "Membatalkan nomor",
  "letter.category_edit": "Mengubah kategori",
  "letter.document_upload": "Mengunggah dokumen",
  "letter.document_download": "Mengunduh dokumen",
  "letters.import": "Impor data awal",
  "user.invite": "Mengundang pengguna",
  "user.invite_resend": "Mengirim ulang undangan",
  "user.accept_invite": "Mengaktifkan akun",
  "user.update": "Mengubah pengguna",
  "user.password_change": "Mengganti password",
  "user.password_reset_request": "Meminta reset password",
  "user.password_reset": "Mengatur ulang password",
  "tenant.register": "Mendaftarkan instansi",
  "tenant.seed": "Membuat instansi",
  "tenant.create": "Membuat instansi",
  "tenant.status": "Mengubah status instansi",
  "tenant.settings_update": "Mengubah kebijakan instansi",
  "unit.create": "Menambah unit",
  "letter_type.create": "Menambah jenis surat",
  "letter_type.update": "Mengubah jenis surat",
};

export const fmtDate =(d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-";

export const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) : "-";
