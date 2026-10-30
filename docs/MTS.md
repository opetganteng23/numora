# NUMORA — Master Technical Specification (MTS)

| | |
|---|---|
| Produk | NUMORA — *Numbering, Simplified* |
| Versi dokumen | 1.0 (mengacu pada kode `numora` v0.1.0) |
| Tanggal | 2026-10-30 |
| Status | Draft — backend selesai, antarmuka belum, verifikasi build belum dijalankan |

---

## 1. Ringkasan

NUMORA adalah SaaS multi-instansi (multi-tenant) untuk penomoran surat resmi. Pemohon mengajukan nomor, approver menyetujui, dan nomor diterbitkan **saat persetujuan** secara atomik sehingga **tidak ada nomor ganda maupun bolong**. Seluruh aktivitas tercatat di audit log.

### 1.1 Tujuan
- Penomoran surat yang unik, berurutan, dan dapat diaudit per instansi.
- Format nomor dapat dikonfigurasi per jenis surat tanpa mengubah kode.
- Isolasi data antar instansi dan pembagian peran yang jelas.

### 1.2 Di luar lingkup (versi saat ini)
Persetujuan bertingkat, penolakan permintaan pembatalan, unggah file surat, ekspor Excel/PDF, QR verifikasi, rate limit per IP, lupa password, SSO/OAuth, UI lengkap (lihat bagian 12).

---

## 2. Arsitektur

| Lapisan | Teknologi |
|---|---|
| Runtime | Node.js ≥ 20.6 |
| Framework | Next.js 15 (App Router, full-stack), React 19 |
| Database | MongoDB Atlas (wajib replica set, karena memakai transaksi) |
| ODM | Mongoose 8 |
| Validasi | Zod 3 |
| Sesi | JWT (jose, HS256) dalam cookie `httpOnly` |
| Password | bcryptjs, cost 12 |
| Email | Nodemailer (Gmail App Password; dapat diganti provider lain di `src/lib/mailer.ts`) |
| Uji | Vitest, skrip uji konkurensi (`tsx`) |

### 2.1 Struktur kode

```
src/
  app/            Halaman (login, accept-invite, dashboard) dan route handler /api/*
  lib/            numbering (logika murni), issue-number (mesin penomoran), rbac, auth,
                  session, password, http (wrapper handler), errors, db, mailer, mail-templates
  models/         Skema Mongoose: Tenant, User, Unit, LetterType, Letter, Counter,
                  AuditLog, Invitation
  services/       Logika bisnis: letters, letter-types, invitations, audit, notify
scripts/          db-init.ts, concurrency-test.ts
tests/            numbering.test.ts
```

Pola: *route handler* tipis (parse input Zod → panggil service) → *service* (aturan bisnis + transaksi) → *model*. Semua route dibungkus `handle()` yang memeriksa Origin, menyambung DB, dan memetakan error ke respons JSON.

---

## 3. Model Data

Semua koleksi data instansi memuat `tenantId`; setiap query wajib menyertakannya.

| Koleksi | Field utama | Index penting |
|---|---|---|
| **Tenant** | `name`, `slug`, `status` (active/suspended), `timeZone` (default `Asia/Jakarta`) | `slug` unik |
| **User** | `tenantId` (null untuk super_admin), `name`, `email`, `passwordHash` (select:false), `role`, `unitId`, `status`, `failedLogins`, `lockedUntil`, `lastLoginAt` | `email` unik **global** |
| **Unit** | `tenantId`, `name`, `code` | `(tenantId, code)` unik |
| **LetterType** | `tenantId`, `name`, `code`, `formatPattern`, `padding` (1–8), `resetPolicy`, `perUnit`, `approverIds[]`, `formatVersion`, `active` | `(tenantId, code)` unik; `(tenantId, approverIds)` |
| **Letter** | `tenantId`, `letterTypeId`, `unitId`, `requesterId`, `subject`, `recipient`, `letterDate`, `status`, `number{seq, period, counterKey, full, formatVersion, issuedAt}`, `approvedBy/At`, `rejectedBy/At/Reason`, `cancelRequest{by, reason, at}`, `cancelledBy/At/Reason`, `fileUrl` | unik parsial `(tenantId, number.full)` dan `(tenantId, number.counterKey, number.seq)`; `(tenantId, status, createdAt)`; `(tenantId, requesterId, createdAt)`; `(tenantId, letterTypeId, status)` |
| **Counter** | `key` (unik), `tenantId`, `letterTypeId`, `unitId`, `period`, `seq` | `key` unik |
| **AuditLog** | `tenantId`, `actorId`, `action`, `entityType`, `entityId`, `meta`, `createdAt` | `(tenantId, createdAt)`, `(tenantId, entityType, entityId)` |
| **Invitation** | `tenantId`, `email`, `name`, `role`, `unitId`, `tokenHash` (SHA-256), `expiresAt`, `usedAt`, `invitedBy` | `tokenHash` unik; TTL 30 hari setelah `expiresAt` |

`autoIndex` **dimatikan**; index dibuat lewat `npm run db:init`.

---

## 4. Mesin Penomoran

### 4.1 Format nomor
Token: `{urut}` `{jenis}` `{unit}` `{bulan}` `{bulan_romawi}` `{tahun}`.
Contoh: `{urut}/{jenis}/{unit}/{bulan_romawi}/{tahun}` → `012/MOU/LEGAL/X/2026`. Default: `{urut}/{jenis}/{bulan_romawi}/{tahun}`.

### 4.2 Kebijakan reset
`yearly` | `monthly` | `never`. Periode dihitung pada **zona waktu instansi** (31 Des 20:00 UTC = 1 Jan WIB).

### 4.3 Aturan validasi konfigurasi (`validatePattern`)
- `{urut}` wajib tepat satu kali; token tidak dikenal dan kurung tidak seimbang ditolak; panjang 1–120.
- `yearly` → wajib `{tahun}`.
- `monthly` → wajib `{tahun}` dan `{bulan}` atau `{bulan_romawi}`.
- `perUnit` → wajib `{unit}`.
- `resetPolicy` dan `perUnit` **terkunci** setelah jenis surat memiliki surat. Mengubah format menaikkan `formatVersion`; nomor lama tidak berubah.

### 4.4 Kunci counter
`tenantId : letterTypeId : (unitId | -) : period`

### 4.5 Penerbitan nomor (`issueNumber`)
1. Hitung periode pada zona waktu instansi.
2. `findOneAndUpdate({key}, {$inc:{seq:1}, $setOnInsert:{…}}, {upsert, new, session})` — kenaikan atomik di server MongoDB.
3. Format teks nomor dari `seq`, kode jenis, kode unit, dan tanggal.
4. Berjalan **di dalam transaksi yang sama** dengan perubahan status surat dan audit log; bila transaksi gagal, counter ikut rollback.

### 4.6 Jaminan keunikan (berlapis)
1. Counter atomik. 2. Transaksi tunggal (counter + surat + audit). 3. Approver kedua melihat status ≠ `pending` → 409. 4. Unique index `(tenantId, number.full)` dan `(tenantId, counterKey, seq)`. 5. `validatePattern`.

Nomor dibuat saat **approve**, bukan saat pengajuan, sehingga penolakan tidak meninggalkan nomor bolong. Nomor yang dibatalkan tetap tercatat dan **tidak dipakai ulang**.

---

## 5. Alur Status Surat

```
pending ──approve──▶ approved ──cancel──▶ cancelled
   │                    │
   └──reject──▶ rejected └─ cancel-request (status tetap approved; mencatat cancelRequest)
```

| Aksi | Syarat | Mekanisme |
|---|---|---|
| Ajukan | Peran tenant_admin / unit_admin / staff; jenis surat aktif; staf & unit_admin hanya untuk unit sendiri | Buat surat `pending`, audit, email ke approver |
| Setujui | Approver jenis surat atau tenant_admin; status `pending` | Transaksi + `issueNumber` + audit; email ke pemohon |
| Tolak | Approver; status `pending` | Update bersyarat `status:"pending"`; alasan maks 500 karakter |
| Ajukan pembatalan | Pemohon, unit_admin unit terkait, tenant_admin; status `approved` dan belum ada `cancelRequest` | Update bersyarat |
| Batalkan | tenant_admin atau unit_admin unit terkait; status `approved` | Update bersyarat; nomor tidak dihapus |

Transaksi memakai `withRetry` untuk *transient transaction error*.

---

## 6. Peran dan Hak Akses (RBAC)

| Peran | Cakupan |
|---|---|
| `super_admin` | Kelola instansi (tenant). **Tidak** punya akses isi surat instansi. `tenantId = null`. |
| `tenant_admin` | Seluruh data instansi: jenis surat, unit, pengguna, persetujuan, pembatalan, audit. |
| `unit_admin` | Surat unitnya; mengajukan/membatalkan di unitnya. Wajib memiliki unit. |
| `staff` | Mengajukan nomor; melihat miliknya. |
| `auditor` | Read-only: semua surat dan audit log. |
| *Approver* | Bukan peran; daftar `approverIds` per jenis surat. `tenant_admin` selalu boleh. |

**Cakupan daftar surat** (`listLetters`): `tenant_admin` & `auditor` = semua; `staff` & `unit_admin` = milik sendiri + jenis surat yang ia approve (+ unitnya untuk `unit_admin`).

Hak akses dibaca ulang dari DB pada setiap request (`getCurrentUser`), sehingga penonaktifan akun/instansi dan perubahan peran berlaku seketika.

---

## 7. Spesifikasi API

Semua respons JSON. Error: `{ "error": string, "code"?: string }`; kesalahan validasi Zod → 400 dengan `issues`.

| Method | Path | Akses | Catatan |
|---|---|---|---|
| POST | `/api/auth/login` | publik | Set cookie sesi |
| POST | `/api/auth/logout` | sesi | Hapus cookie |
| POST | `/api/auth/accept-invite` | publik (token) | Buat akun dari undangan |
| GET | `/api/auth/me` | login | |
| GET | `/api/letters` | tenant user | Query: `status`, `letterTypeId`, `q`, `page` (≥1), `limit` (1–100, default 20) |
| POST | `/api/letters` | tenant_admin, unit_admin, staff | Body: `letterTypeId`, `unitId?`, `subject` (≤300), `recipient` (≤300), `letterDate` |
| POST | `/api/letters/:id/approve` | approver / tenant_admin | Menerbitkan nomor |
| POST | `/api/letters/:id/reject` | approver / tenant_admin | Body: `reason` |
| POST | `/api/letters/:id/cancel-request` | pemohon / unit_admin / tenant_admin | Body: `reason` |
| POST | `/api/letters/:id/cancel` | tenant_admin / unit_admin unit terkait | Body: `reason` |
| GET, POST | `/api/letter-types` | baca: semua; tulis: tenant_admin | |
| PATCH | `/api/letter-types/:id` | tenant_admin | Menaikkan `formatVersion` bila format berubah |
| GET, POST | `/api/units` | baca: semua; tulis: tenant_admin | |
| GET | `/api/users` | tenant_admin, unit_admin, auditor | |
| POST | `/api/users/invite` | tenant_admin | Kirim email undangan |
| GET | `/api/audit` | tenant_admin, auditor | |
| GET, POST | `/api/admin/tenants` | super_admin | |

Kode status: 400 input tidak valid · 401 belum login · 403 tidak berwenang · 404 tidak ditemukan · 409 konflik/sudah diproses/duplikat · 422 aturan bisnis · 429 akun terkunci · 500 galat server.

---

## 8. Keamanan

| Aspek | Implementasi |
|---|---|
| Autentikasi | Email + password; JWT HS256 hanya memuat `uid`, masa berlaku 12 jam |
| Cookie | `httpOnly`, `sameSite=lax`, `secure` di produksi, path `/` |
| `SESSION_SECRET` | Wajib ≥ 32 karakter; aplikasi menolak berjalan bila kurang |
| Password | bcrypt cost 12; perbandingan ke hash palsu bila user tidak ada (anti *timing/enumeration*) |
| Brute force | Kunci akun 15 menit setelah 5 kali gagal login |
| CSRF | Request tulis dengan header `Origin` harus sama dengan host (`x-forwarded-host`/`host`) |
| Isolasi tenant | `tenantId` di setiap query; `requireTenantUser` menolak super_admin pada endpoint data instansi |
| Undangan | Token acak 32 byte, hanya hash SHA-256 yang disimpan, berlaku 72 jam, sekali pakai (klaim atomik, dikembalikan bila pembuatan akun gagal) |
| Pencarian | Input `q` di-*escape* sebelum menjadi regex |
| Audit | Aksi bisnis dicatat; aksi penerbitan nomor ada di transaksi yang sama |

---

## 9. Notifikasi Email

- Surat baru → approver jenis surat + semua `tenant_admin` aktif.
- Keputusan (approve/reject) → pemohon, memuat nomor atau alasan.
- Undangan pengguna → tautan `APP_URL/accept-invite?token=…`.
- Fungsi notifikasi dipanggil **setelah commit**, tidak pernah melempar error (kegagalan hanya dicatat ke log). `MAIL_DISABLED=1` mencetak email ke console.

---

## 10. Konfigurasi dan Deployment

| Variabel | Fungsi |
|---|---|
| `MONGODB_URI` | Koneksi MongoDB Atlas (replica set) |
| `SESSION_SECRET` | Kunci penandatangan JWT (≥ 32 karakter) |
| `APP_URL` | URL publik untuk tautan email |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM` | Pengiriman email |
| `MAIL_DISABLED` | `1` untuk menonaktifkan pengiriman |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Seed Super Admin (password ≥ 10 karakter) |

**Prosedur:** `npm install` → isi `.env` → `npm run db:init` (koleksi, index, super admin; wajib dijalankan lebih dulu) → `npm run typecheck && npm test` → `npm run test:concurrency` (database uji) → `npm run build` → `npm start`. Ulangi `db:init` pada deploy yang mengubah index.

Koneksi DB di-cache di `globalThis` (aman untuk hot-reload dan serverless), `maxPoolSize 10`, `serverSelectionTimeoutMS 8000`.

---

## 11. Pengujian dan Kriteria Penerimaan

| Uji | Cakupan | Status |
|---|---|---|
| `tests/numbering.test.ts` (Vitest) | Logika murni: format, romawi, zona waktu, periode, validasi pola | Lulus (dijalankan dengan Node) |
| `scripts/concurrency-test.ts` | Penerbitan nomor paralel: tanpa duplikat, tanpa bolong | **Belum dijalankan** |
| Typecheck, `next build`, `db:init` | Kompilasi dan inisialisasi | **Belum dijalankan** |

**Kriteria rilis produksi:**
1. `typecheck`, `test`, `build` hijau.
2. `test:concurrency` lulus pada database uji.
3. Kebijakan *self-approval* diputuskan dan diimplementasikan (bagian 13).
4. UI minimal tersedia (bagian 12).
5. Pengiriman email diganti ke provider domain sendiri untuk SaaS.

---

## 12. Kekurangan Saat Ini

- **Antarmuka**: hanya login, aktivasi undangan, dan placeholder dashboard; semua fungsi sudah tersedia di API.
- Persetujuan bertingkat; penolakan permintaan pembatalan.
- Unggah file surat (`fileUrl` sudah ada di skema, belum ada alur unggah).
- Ekspor Excel/PDF; QR verifikasi keaslian nomor.
- Rate limit per IP; lupa/reset password; SSO/OAuth.

## 13. Keputusan Terbuka dan Risiko

| # | Isu | Rekomendasi |
|---|---|---|
| 1 | **Self-approval**: kode saat ini mengizinkan pemohon yang juga approver/tenant_admin menyetujui pengajuannya sendiri. | Putuskan kebijakan; bila dilarang, tolak di `approveLetter` jika `requesterId == userId` (dengan pengecualian terdokumentasi untuk instansi satu admin). |
| 2 | **Email unik global**: satu akun hanya satu instansi. | Terima untuk v1; desain ulang (relasi `Membership`) bila perlu multi-instansi. |
| 3 | **Sesi JWT sendiri**, tanpa pencabutan token per sesi (hanya lewat status user di DB). | Cukup untuk v1; pertimbangkan Auth.js bila butuh SSO. |
| 4 | **Gmail App Password** memiliki batas kirim harian. | Pindah ke Resend/SES/SMTP domain sebelum produksi. |
| 5 | Tidak ada rate limit pada login selain kunci per akun. | Tambah rate limit per IP di edge/middleware. |
| 6 | Verifikasi build dan uji konkurensi belum pernah dijalankan. | Jalankan sebelum pengembangan lanjutan; perbaiki galat tipe bila ada. |

## 14. Peta Jalan yang Disarankan

1. **Stabilisasi**: install, typecheck, build, `db:init`, uji konkurensi; putuskan self-approval.
2. **UI inti**: daftar surat, form pengajuan, layar persetujuan, kelola jenis surat/unit/pengguna, audit log.
3. **Operasional**: reset password, rate limit, provider email produksi, pemantauan.
4. **Fitur lanjutan**: persetujuan bertingkat, unggah file, ekspor, QR verifikasi.
