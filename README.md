# Moodboard.co.id

Moodboard Studio untuk arsitek dan desainer interior. Kode aplikasi berasal dari proyek **Moodboard Builder** di Replit, dengan frontend React/Vite, API Express, PostgreSQL, dan autentikasi Clerk.

## Menjalankan aplikasi

Gunakan Node.js 24 dan sediakan variabel lingkungan sesuai `.env.example` melalui shell atau platform hosting.

```sh
npm ci
npm run dev
```

Build produksi dan pemeriksaan:

```sh
npm run check
npm run test:export
npm run test:image-recovery
npm run test:storage
npm run build
npm start
```

## Railway

`railway.json` menetapkan build, start, restart, serta pemeriksaan kesehatan `/healthz`. Pemeriksaan tersebut juga memastikan database dapat dijangkau.

Layanan membutuhkan PostgreSQL dan bucket S3. Gunakan variabel referensi Railway untuk `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, dan `S3_SECRET_ACCESS_KEY`. Set `STORAGE_BACKEND=s3`; bucket Railway memakai virtual-host addressing (`S3_FORCE_PATH_STYLE=false`).

`PRIVATE_OBJECT_DIR` berformat `/<bucket>/<prefix-private>` dan `PUBLIC_OBJECT_SEARCH_PATHS` berisi path publik dengan format yang sama. Pertahankan prefix ketika memindahkan objek dari Replit agar URL `/objects/uploads/...` tetap berlaku. Metadata ACL disimpan bersama objek S3. Alur upload URL memerlukan login.

Salin konfigurasi instance **Production** Clerk yang sama dengan aplikasi yang dipublikasikan ke `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, dan `VITE_CLERK_PUBLISHABLE_KEY` agar akun pengguna tetap terhubung. Kunci workspace Development berbeda dari kunci Production. Nilai `VITE_*` harus tersedia saat build. Jika sumber memakai proxy Clerk, isi `VITE_CLERK_PROXY_URL=/api/__clerk`.

Migrasikan database melalui **Tools → Database → Production Database → Settings** di Replit. `DATABASE_URL` pada Shell workspace mengarah ke Development dan bukan database situs yang dipublikasikan. Pertahankan ID pengguna lama beserta klaim Clerk `userId` agar kepemilikan proyek tetap sama.

Fitur AI memakai `OPENAI_API_KEY`. Email memakai `RESEND_API_KEY` dan `RESEND_FROM_EMAIL`. Set `SITE_URL` ke URL aplikasi. Login admin membutuhkan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`; password tidak memiliki fallback bawaan.

## Data dan konfigurasi privat

Jangan commit kredensial, file `.env`, ekspor database, arsip migrasi, atau unggahan pengguna. Simpan data pada database/bucket privat dan atur rahasia melalui Variables Railway. Repositori berisi kode serta aset tampilan aplikasi.

Sebelum mengalihkan domain, verifikasi jumlah baris database, kelengkapan objek, login, upload, ekspor PDF, dan fitur AI/email yang telah dikonfigurasi. Perubahan DNS dilakukan terpisah dari deployment aplikasi.
