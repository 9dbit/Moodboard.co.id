# Moodboard.co.id

Moodboard Studio untuk arsitek dan desainer interior, dengan frontend React/Vite, API Express, PostgreSQL, dan autentikasi email/password mandiri. Aplikasi tidak membutuhkan akun Replit atau Clerk.

## Menjalankan aplikasi

Gunakan Node.js 24 dan sediakan variabel lingkungan sesuai `.env.example` melalui shell atau platform hosting.

```sh
npm ci
npm run dev
```

Build produksi dan pemeriksaan:

```sh
npm run check
npm run test:auth
npm run test:export
npm run test:image-recovery
npm run test:storage
npm run build
npm start
```

Pengujian integrasi autentikasi memerlukan PostgreSQL lokal terisolasi bernama `moodboard_auth_test` pada localhost dan variabel `AUTH_TEST_DATABASE_URL`. Tanpa variabel tersebut, `test:auth` hanya menjalankan pemeriksaan kriptografi dan melewati pengujian database. Jangan gunakan database produksi untuk pengujian.

## Railway

`railway.json` menetapkan build, start, restart, serta pemeriksaan kesehatan `/healthz`. Pemeriksaan tersebut juga memastikan database dapat dijangkau.

Layanan membutuhkan PostgreSQL dan bucket S3. Gunakan variabel referensi Railway untuk `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, dan `S3_SECRET_ACCESS_KEY`. Bucket Railway memakai virtual-host addressing (`S3_FORCE_PATH_STYLE=false`). Tidak ada fallback penyimpanan ke layanan hosting lain.

`PRIVATE_OBJECT_DIR` berformat `/<bucket>/<prefix-private>` dan `PUBLIC_OBJECT_SEARCH_PATHS` berisi path publik dengan format yang sama. Pertahankan prefix ketika memindahkan objek agar URL `/objects/uploads/...` tetap berlaku. Metadata ACL disimpan bersama objek S3. Alur upload URL memerlukan login.

## Login dan pemulihan akun

Pengguna baru mendaftar menggunakan email dan password minimal 12 karakter. Password disimpan sebagai hash; cookie sesi menggunakan token acak yang hash-nya disimpan dalam PostgreSQL. Cookie bersifat HttpOnly, Secure pada produksi, dan SameSite=Lax. Tidak diperlukan kunci atau proxy penyedia autentikasi eksternal.

ID pengguna lama serta hubungan kepemilikan proyek tetap dipertahankan. Password dari penyedia login sebelumnya tidak dapat dipindahkan. Admin perlu memverifikasi identitas pemilik sebelum menerbitkan tautan aktivasi/pemulihan sekali pakai untuk akun lama, terutama akun yang belum memiliki email. Mengetahui alamat email saja tidak memberikan akses ke akun lama. Tautan pemulihan adalah rahasia; kirim hanya kepada pemilik akun yang sudah diverifikasi.

Fitur AI memakai `OPENAI_API_KEY` langsung. Email pemulihan password bersifat opsional dan memakai `RESEND_API_KEY` serta `RESEND_FROM_EMAIL`. Tanpa layanan email, admin dapat menerbitkan tautan aktivasi/pemulihan sekali pakai secara manual. Set `SITE_URL` ke URL HTTPS aplikasi agar tautan mengarah ke domain yang benar. Login admin membutuhkan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`; password tidak memiliki fallback bawaan.

## Data dan konfigurasi privat

Jangan commit kredensial, file `.env`, ekspor database, arsip migrasi, atau unggahan pengguna. Simpan data pada database/bucket privat dan atur rahasia melalui Variables Railway. Repositori berisi kode serta aset tampilan aplikasi.

Sebelum mengalihkan domain, verifikasi jumlah baris database, kelengkapan objek, login, upload, ekspor PDF, dan fitur AI/email yang telah dikonfigurasi. Perubahan DNS dilakukan terpisah dari deployment aplikasi.
