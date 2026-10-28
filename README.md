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
npm test
npm run test:auth
npm run test:export
npm run test:image-recovery
npm run test:storage
npm run build
npm start
```

Pengujian integrasi autentikasi memerlukan PostgreSQL lokal terisolasi bernama `moodboard_auth_test` pada localhost dan variabel `AUTH_TEST_DATABASE_URL`. Tanpa variabel tersebut, `test:auth` hanya menjalankan pemeriksaan kriptografi dan melewati pengujian database. Jangan gunakan database produksi untuk pengujian.

CI menjalankan `npm run test:ci` dengan `AUTH_TEST_DATABASE_URL`, `PAYMENT_TEST_DATABASE_URL` (`moodboard_payment_test`), `EXPORT_TEST_DATABASE_URL` (`moodboard_export_test`), serta `CHROMIUM_PATH`. Semua database wajib lokal/terisolasi. `node script/create-test-databases.mjs` menyiapkan dua database tambahan dengan nama tetap. CI menolak konfigurasi test yang tidak lengkap agar integration test tidak terlewati.

## Plugin ChatGPT pribadi

Endpoint MCP Streamable HTTP tersedia di `https://moodboard.co.id/mcp`. Petunjuk untuk pengguna ada di `/chatgpt`. Tambahkan endpoint melalui **ChatGPT Work → Plugins → Add custom MCP server**, pilih **OAuth**, lalu masuk dan setujui izin di Moodboard. Endpoint ini memerlukan Bearer token; cookie website tidak memberikan akses MCP. Pengguna dapat mencabut koneksi dari Profile.

OAuth menggunakan router SDK MCP resmi, PKCE S256, discovery metadata, dynamic client registration, persetujuan pengguna, authorization code sekali pakai, access token satu jam, dan refresh token berotasi. Token disimpan sebagai hash; reset password membatalkan grant lama. `SITE_URL` wajib berisi origin HTTPS canonical pada produksi. Redirect URI OAuth didaftarkan tepat sesuai client; tidak ada wildcard callback atau password yang dimasukkan ke percakapan.

Tools memakai schema sempit dan identitas dari token: membaca/menulis moodboard, memasukkan referensi yang dipilih, dan mengekspor PDF. Write yang mendukung retry memakai `idempotency_key` yang harus sama saat mengulang permintaan yang sama. Edit board memakai `updatedAt` terbaru sebagai `expected_version`, sehingga perubahan dari versi lama ditolak.

Schema tambahan OAuth, upload intent, impor persisten, kontak, dan export job dibuat secara additive pada startup. Tidak ada penyalinan ulang atau penghapusan data pengguna. Job impor/ekspor memakai lease dan dapat dipulihkan setelah restart. Export worker berjalan pada proses aplikasi, satu job per proses, dengan batas eksplisit untuk melindungi sumber daya.

PDF server memakai template ringkas dan font Noto Sans berlisensi OFL yang dibundel di `server/assets`; bukan salinan piksel dari seluruh tema browser. Seluruh referensi yang dipilih harus tercakup atau job gagal dengan pesan jelas. Hasil PDF privat disimpan pada prefix `exports`, berlaku 24 jam; tautan download terotorisasi berlaku 15 menit. Ekspor browser juga mempertahankan seluruh halaman.

Integrasi ini disiapkan sebagai plugin pribadi/tim. Distribusi publik memerlukan pengajuan dan review OpenAI terpisah. Live gateway pembayaran dan layanan email opsional harus divalidasi dengan konfigurasi pemilik sebelum mengandalkannya untuk transaksi/email sungguhan.

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
