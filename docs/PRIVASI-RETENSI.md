# Privasi dan Retensi Data NUMORA

Dokumen ini menjelaskan data apa yang disimpan NUMORA, bagaimana dilindungi, dan berapa lama disimpan. Isinya mencerminkan perilaku aplikasi saat ini. Bagian "Belum diterapkan" jujur menyebut yang belum ada.

## 1. Data yang disimpan

| Data | Isi | Keterangan |
|---|---|---|
| Akun pengguna | Nama, email, peran, unit, status | Password disimpan sebagai hash bcrypt (cost 12), tidak pernah dalam bentuk asli |
| Autentikasi dua langkah | Rahasia TOTP, hash kode pemulihan | Rahasia dienkripsi AES-256-GCM. Kode pemulihan hanya berupa hash |
| Surat | Nomor, jenis, kategori, perihal, tujuan, tanggal, pemohon, status | Perihal dan tujuan dapat memuat data pribadi, tergantung isi yang diketik pengguna |
| Dokumen final | Berkas (PDF, DOCX, XLSX, PNG, JPG), nama berkas, ukuran, hash SHA-256, pengunggah | Disimpan di folder privat server, di luar folder web |
| Jejak audit | Pelaku, aksi, objek, waktu, metadata singkat | Tidak memuat password atau isi dokumen |
| Undangan dan reset password | Hash token, email, masa berlaku | Token hanya berlaku sekali dan kedaluwarsa |
| Log aplikasi | Pesan galat server | Dikelola PM2 di server |

## 2. Siapa yang dapat mengakses

- Setiap instansi (tenant) terisolasi: semua kueri dibatasi `tenantId`.
- Staf melihat suratnya sendiri dan surat yang ia setujui. Admin unit melihat unit-nya. Admin instansi dan auditor melihat seluruh surat instansi. Auditor hanya membaca.
- Super Admin hanya mengelola instansi dan tidak melihat isi surat.
- Halaman verifikasi publik (QR) hanya menampilkan nomor, instansi, jenis surat, tanggal, status, dan hash dokumen. Perihal, tujuan, dan nama orang tidak ditampilkan. Tautannya memakai kode tak tertebak per surat.
- Setiap unggah dan unduh dokumen tercatat di jejak audit.

## 3. Perlindungan

- Transport: HTTPS dengan sertifikat otomatis.
- Sesi: cookie bertanda tangan, peran dibaca ulang dari database pada setiap permintaan.
- Pembatasan percobaan: penguncian akun setelah 5 kali gagal login, pembatas laju per alamat IP pada rute sensitif.
- Integritas: hash SHA-256 dokumen diperiksa ulang setiap kali diunduh.
- Nomor surat yang sudah terbit tidak pernah dihapus atau dipakai ulang.

## 4. Retensi

| Data | Masa simpan saat ini |
|---|---|
| Surat, nomor, dan dokumen final | Selama instansi aktif. Tidak dihapus otomatis |
| Versi dokumen lama | Disimpan seluruhnya, tidak pernah ditimpa |
| Jejak audit | Disimpan tanpa batas waktu |
| Undangan dan token reset | Kedaluwarsa dalam waktu singkat, tidak dihapus otomatis |
| Cadangan database dan berkas | 14 hari, lalu dihapus oleh skrip cadangan (`KEEP_DAYS`) |

Nomor surat dan jejak audit sengaja tidak dapat dihapus karena menjadi bukti penomoran yang sah.

## 5. Permintaan terkait data pribadi

- Koreksi nama, peran, atau unit: admin instansi melalui menu Pengaturan.
- Penonaktifan akun: admin instansi. Akun dinonaktifkan, bukan dihapus, agar riwayat audit tetap utuh.
- Penghapusan data pribadi pengguna atau perihal surat yang memuat data pribadi: belum ada fitur di aplikasi. Saat ini dilakukan oleh pengelola sistem langsung pada database setelah permintaan tertulis dari admin instansi, dan tindakannya dicatat manual.

## 6. Belum diterapkan

- Penghapusan atau anonimisasi data pribadi otomatis sesuai masa retensi.
- Pembersihan otomatis undangan dan token reset yang sudah kedaluwarsa.
- Enkripsi berkas dokumen di disk (saat ini mengandalkan izin folder 700 milik pengguna server).
- Cadangan di luar server. Cadangan sekarang tersimpan di server yang sama.
- Pemantauan ketersediaan oleh layanan eksternal.

Tanggal dokumen: 31 Oktober 2026.
