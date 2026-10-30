# NUMORA — Numbering, Simplified

Sistem penomoran surat multi-instansi (SaaS). Next.js (App Router, full-stack) + MongoDB Atlas + Mongoose.

## Menjalankan

```bash
npm install
cp .env.example .env        # isi MONGODB_URI, SESSION_SECRET (>=32 karakter), kredensial Gmail
npm run db:init             # buat koleksi + index, dan Super Admin dari SUPERADMIN_EMAIL/PASSWORD
npm run typecheck && npm test
npm run test:concurrency    # WAJIB lulus sebelum produksi (pakai database UJI)
npm run dev
```

> `db:init` harus dijalankan lebih dulu: transaksi butuh koleksi sudah ada, dan `autoIndex` sengaja dimatikan.

## Alur utama

```
Staf mengajukan  ->  pending (BELUM ada nomor)
Approver setuju  ->  approved (nomor terbit di sini, atomik)
Approver tolak   ->  rejected (urutan tidak terpakai, tidak bolong)
Pemohon/Admin unit mengajukan pembatalan -> cancelRequest
Admin unit/instansi membatalkan -> cancelled (nomor tetap tercatat, tidak dipakai ulang)
```

Nomor dibuat **saat disetujui**, bukan saat diajukan, agar penolakan tidak menimbulkan nomor bolong.

## Mengapa tidak ada nomor ganda / bolong

1. `issueNumber` memakai `findOneAndUpdate({key}, {$inc: {seq: 1}}, {upsert})`: kenaikan atomik di server MongoDB.
2. Kenaikan counter, perubahan status surat, dan audit log berada dalam **satu transaksi**. Jika gagal, counter ikut rollback.
3. Dua approver menyetujui surat yang sama: yang kedua melihat status bukan `pending` dan ditolak (409).
4. Pengaman terakhir: unique index `(tenantId, number.full)` dan `(tenantId, number.counterKey, number.seq)`.
5. `validatePattern` mencegah konfigurasi yang bisa menghasilkan teks nomor sama (mis. reset tahunan tanpa `{tahun}`).

Kunci counter: `tenant : jenis surat : (unit | -) : periode`. Periode dihitung pada zona waktu instansi (WIB: 31 Des 20:00 UTC sudah 1 Jan).

## Format nomor

Token: `{urut}` `{jenis}` `{unit}` `{bulan}` `{bulan_romawi}` `{tahun}`.
Contoh: `{urut}/{jenis}/{unit}/{bulan_romawi}/{tahun}` -> `012/MOU/LEGAL/X/2026`.
Reset: `yearly` | `monthly` | `never`. Opsi `perUnit` memisahkan urutan per unit.
Mengubah format menaikkan `formatVersion`; nomor lama tidak berubah. `resetPolicy`/`perUnit` terkunci setelah ada surat.

## Peran

| Peran | Cakupan |
|---|---|
| `super_admin` | Kelola instansi (tenant). Tidak punya akses ke isi surat instansi. |
| `tenant_admin` | Semua data instansi: jenis surat, unit, pengguna, persetujuan, pembatalan, audit. |
| `unit_admin` | Surat unitnya; mengajukan/membatalkan nomor di unitnya. |
| `staff` | Mengajukan nomor, melihat miliknya. |
| `auditor` | Read-only: semua surat dan audit log. |
| *Approver* | Bukan peran: daftar `approverIds` pada tiap jenis surat. `tenant_admin` selalu boleh. |

## API

| Method | Path | Akses |
|---|---|---|
| POST | `/api/auth/login` · `/logout` · `/accept-invite` | publik / sesi |
| GET | `/api/auth/me` | login |
| GET, POST | `/api/letters` | sesuai peran (daftar dibatasi cakupan) |
| POST | `/api/letters/:id/approve` · `reject` · `cancel-request` · `cancel` | approver / pemohon / admin |
| GET, POST | `/api/letter-types` · PATCH `/api/letter-types/:id` | baca: semua · tulis: tenant_admin |
| GET, POST | `/api/units` | baca: semua · tulis: tenant_admin |
| GET | `/api/users` · POST `/api/users/invite` | tenant_admin (GET juga unit_admin/auditor) |
| GET | `/api/audit` | tenant_admin, auditor |
| GET, POST | `/api/admin/tenants` | super_admin |

## Keputusan desain yang perlu Anda ketahui

- **Sesi memakai JWT cookie sendiri (jose), bukan Auth.js.** Lebih sedikit bagian bergerak dan mudah diaudit; role dibaca ulang dari DB di setiap request, jadi pencabutan akses langsung berlaku. Bisa diganti Auth.js nanti bila perlu OAuth/SSO.
- **Email unik global** (satu akun = satu instansi). Jika satu orang perlu masuk ke banyak instansi, ini perlu didesain ulang.
- **Mailer** dibungkus `src/lib/mailer.ts`. Gmail App Password cocok untuk awal; untuk SaaS, pindah ke Resend/SES/SMTP domain sendiri cukup dengan menambah provider di file itu.
- Kunci akun 15 menit setelah 5 kali gagal login; pemeriksaan Origin dasar untuk request tulis.

## Belum dibuat (sengaja)

- Antarmuka: hanya login, aktivasi undangan, dan placeholder dashboard. Semua fungsi sudah ada di API.
- Persetujuan bertingkat, menolak permintaan pembatalan, unggah file surat, ekspor Excel/PDF, QR verifikasi, rate limit per IP, lupa password.
- Larangan menyetujui pengajuan sendiri (self-approval) — **putuskan kebijakannya** sebelum produksi.

## Status verifikasi

- Lulus: logika murni penomoran (`tests/numbering.test.ts`, 8 kelompok tes) dijalankan dengan Node.
- **Belum dijalankan:** `npm install`, typecheck, `next build`, `db:init`, dan `test:concurrency` (lingkungan penyusun tidak dapat menjangkau registry npm maupun MongoDB). Jalankan urutan di atas dan perbaiki bila ada galat tipe.
