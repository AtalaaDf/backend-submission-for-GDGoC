# GDGoC UNSRI API

REST API untuk manajemen core team dan member GDGoC UNSRI. Dibangun dengan **Fastify**, **TypeScript**, **Drizzle ORM**, dan **PostgreSQL**.

## Daftar Isi

- [Arsitektur](#arsitektur)
- [Prasyarat](#prasyarat)
- [Instalasi dan Konfigurasi](#instalasi-dan-konfigurasi)
- [Menjalankan Proyek](#menjalankan-proyek)
- [Akun Uji Tersedia](#akun-uji-tersedia)
- [Dokumentasi Endpoint](#dokumentasi-endpoint)
- [Role dan Hak Akses](#role-dan-hak-akses)
- [Format Respons](#format-respons)
- [Deploy ke Render + Neon](#deploy-ke-render--neon)

---

## Arsitektur

```
src/
  config/          # Validasi environment variable (Zod)
  common/          # Error, respons envelope, pagination, audit helper, clock
  db/              # Skema Drizzle, migrasi, seed
  plugins/         # JWT auth, rate limit, helmet/CORS, Swagger, error handler
  modules/
    auth/           # Login, me, JWT
    users/          # Kelola user, ubah role dan status
    audit-logs/     # Riwayat perubahan data sensitif
    divisions/      # Divisi organisasi
    members/        # Member dengan soft delete
    events/         # Event dengan kuota dan kepemilikan PO
    registrations/  # Pendaftaran event dengan kontrol kuota serentak
    attendances/    # Absensi idempoten dengan validasi jendela waktu
```

Setiap modul mengikuti pola **Routes → Controller → Service → Repository** yang terpisah jelas.

---

## Prasyarat

- **Node.js** >= 20
- **PostgreSQL** >= 16 (atau Docker untuk menjalankan via docker compose)
- **npm** (bukan yarn atau pnpm)

---

## Instalasi dan Konfigurasi

### 1. Clone dan install dependensi

```bash
git clone <URL_REPO>
cd backend-submission-for-GDGoC
npm install
```

### 2. Konfigurasi environment variable

Salin file contoh dan sesuaikan nilainya:

```bash
cp .env.example .env
```

| Variable                   | Keterangan                                              | Default                                                   |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `NODE_ENV`                 | Environment aplikasi                                    | `development`                                             |
| `PORT`                     | Port server                                             | `3000`                                                    |
| `DATABASE_URL`             | Koneksi PostgreSQL                                      | `postgres://gdgoc:gdgoc_password@localhost:5432/gdgoc_db` |
| `JWT_SECRET`               | Secret JWT (min 32 karakter)                            | Wajib diganti di produksi                                 |
| `JWT_EXPIRES_IN`           | Masa berlaku token                                      | `1h`                                                      |
| `CORS_ORIGINS`             | Daftar origin yang diizinkan (koma-pisah)               | `http://localhost:3000`                                   |
| `RATE_LIMIT_MAX`           | Batas request per menit (global)                        | `100`                                                     |
| `LOGIN_RATE_LIMIT_MAX`     | Batas percobaan login per menit                         | `5`                                                       |
| `SEED_SUPERADMIN_PASSWORD` | Password superadmin seed (min 12 karakter, dev default) | `SuperAdminPassword123!`                                  |
| `SEED_ADMIN_PASSWORD`      | Password admin seed (min 12 karakter, dev default)      | `AdminPassword123!`                                       |
| `SEED_EXECUTIVE_PASSWORD`  | Password executive seed (min 12 karakter, dev default)  | `ExecutivePassword123!`                                   |
| `SEED_PO1_PASSWORD`        | Password PO 1 seed (min 12 karakter, dev default)       | `ProductOwner1Password123!`                               |
| `SEED_PO2_PASSWORD`        | Password PO 2 seed (min 12 karakter, dev default)       | `ProductOwner2Password123!`                               |

---

## Menjalankan Proyek

### Via Docker Compose (direkomendasikan)

Menjalankan PostgreSQL dan API sekaligus. Migrasi dan seed dijalankan otomatis.

```bash
docker compose up --build
```

API tersedia di `http://localhost:3000`. Swagger UI tersedia di `http://localhost:3000/docs`.

Hentikan dan hapus volume:

```bash
docker compose down -v
```

### Manual (lokal)

Pastikan PostgreSQL sudah berjalan dan `DATABASE_URL` sudah benar di `.env`.

```bash
# Install dependensi
npm install

# Jalankan migrasi database
npm run db:migrate

# Seed akun awal
npm run db:seed

# Jalankan server development
npm run dev
```

### Perintah Lain

| Perintah                 | Keterangan                                         |
| ------------------------ | -------------------------------------------------- |
| `npm run build`          | Kompilasi TypeScript ke `dist/`                    |
| `npm start`              | Jalankan hasil build (produksi)                    |
| `npm test`               | Jalankan seluruh unit test dan integration test    |
| `npm run lint`           | Periksa ESLint                                     |
| `npm run format`         | Format kode dengan Prettier                        |
| `npm run typecheck`      | Periksa TypeScript tanpa kompilasi                 |
| `npm run db:generate`    | Generate file migrasi Drizzle dari perubahan skema |
| `npm run db:migrate`     | Terapkan migrasi ke database                       |
| `npm run db:seed`        | Seed akun dan data awal (idempoten)                |
| `npm run export:openapi` | Ekspor spec OpenAPI ke `docs/openapi.json`         |

---

## Akun Uji Tersedia

Setelah `npm run db:seed` atau `docker compose up`, akun berikut tersedia:

| Email                        | Password (default)          | Role         |
| ---------------------------- | --------------------------- | ------------ |
| `superadmin@gdgoc-unsri.org` | `SuperAdminPassword123!`    | `superadmin` |
| `admin@gdgoc-unsri.org`      | `AdminPassword123!`         | `admin`      |
| `executive@gdgoc-unsri.org`  | `ExecutivePassword123!`     | `executive`  |
| `po1@gdgoc-unsri.org`        | `ProductOwner1Password123!` | `po`         |
| `po2@gdgoc-unsri.org`        | `ProductOwner2Password123!` | `po`         |

> Nilai default di atas hanya berlaku di lingkungan `development` dan `test`. Di lingkungan `production`, skrip seed menolak berjalan jika `SEED_*_PASSWORD` kosong atau memakai nilai contoh bawaan. Runtime API di produksi tidak memerlukan variabel `SEED_*_PASSWORD`.

### Contoh Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@gdgoc-unsri.org", "password": "SuperAdminPassword123!"}'
```

Respons berisi `data.accessToken`. Gunakan token tersebut di header selanjutnya:

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## Dokumentasi Endpoint

Dokumentasi interaktif tersedia di **Swagger UI**: `http://localhost:3000/docs`

File spec OpenAPI tersedia di [`docs/openapi.json`](docs/openapi.json).

### Ringkasan Endpoint

#### Health

| Method | Path            | Auth | Keterangan                                |
| ------ | --------------- | ---- | ----------------------------------------- |
| `GET`  | `/health`       | -    | Liveness probe (tidak menyentuh database) |
| `GET`  | `/health/ready` | -    | Readiness probe (cek koneksi database)    |

#### Auth

| Method | Path                 | Auth   | Keterangan                      |
| ------ | -------------------- | ------ | ------------------------------- |
| `POST` | `/api/v1/auth/login` | -      | Login dan dapatkan access token |
| `GET`  | `/api/v1/auth/me`    | Bearer | Profil user yang sedang login   |

#### Users

| Method  | Path                       | Role       | Keterangan                             |
| ------- | -------------------------- | ---------- | -------------------------------------- |
| `GET`   | `/api/v1/users`            | superadmin | Daftar user (pagination, filter, sort) |
| `PATCH` | `/api/v1/users/:id/role`   | superadmin | Ubah role user                         |
| `PATCH` | `/api/v1/users/:id/status` | superadmin | Aktifkan atau nonaktifkan user         |

#### Audit Logs

| Method | Path                 | Role       | Keterangan                      |
| ------ | -------------------- | ---------- | ------------------------------- |
| `GET`  | `/api/v1/audit-logs` | superadmin | Riwayat perubahan data sensitif |

#### Divisions

| Method   | Path                    | Role       | Keterangan                                   |
| -------- | ----------------------- | ---------- | -------------------------------------------- |
| `GET`    | `/api/v1/divisions`     | semua      | Daftar divisi                                |
| `POST`   | `/api/v1/divisions`     | superadmin | Buat divisi baru                             |
| `PATCH`  | `/api/v1/divisions/:id` | superadmin | Ubah divisi                                  |
| `DELETE` | `/api/v1/divisions/:id` | superadmin | Hapus divisi (ditolak jika masih ada member) |

#### Members

| Method   | Path                          | Role       | Keterangan                                                |
| -------- | ----------------------------- | ---------- | --------------------------------------------------------- |
| `GET`    | `/api/v1/members`             | semua      | Daftar member aktif (pagination, filter, sort, pencarian) |
| `POST`   | `/api/v1/members`             | superadmin | Tambah member baru                                        |
| `PATCH`  | `/api/v1/members/:id`         | superadmin | Ubah data member                                          |
| `DELETE` | `/api/v1/members/:id`         | superadmin | Soft delete member                                        |
| `POST`   | `/api/v1/members/:id/restore` | superadmin | Pulihkan member yang di-soft delete                       |

#### Events

| Method   | Path                 | Role                 | Keterangan                                    |
| -------- | -------------------- | -------------------- | --------------------------------------------- |
| `GET`    | `/api/v1/events`     | semua                | Daftar event aktif (pagination, filter, sort) |
| `POST`   | `/api/v1/events`     | superadmin, po       | Buat event baru                               |
| `GET`    | `/api/v1/events/:id` | semua                | Detail event                                  |
| `PATCH`  | `/api/v1/events/:id` | superadmin, po (own) | Ubah event                                    |
| `DELETE` | `/api/v1/events/:id` | superadmin, po (own) | Soft delete event                             |

#### Registrations

| Method   | Path                                              | Role                        | Keterangan                |
| -------- | ------------------------------------------------- | --------------------------- | ------------------------- |
| `GET`    | `/api/v1/events/:eventId/registrations`           | superadmin, admin, po (own) | Daftar pendaftar event    |
| `POST`   | `/api/v1/events/:eventId/registrations`           | superadmin, admin, po (own) | Daftarkan member ke event |
| `DELETE` | `/api/v1/events/:eventId/registrations/:memberId` | superadmin, admin, po (own) | Batalkan pendaftaran      |

#### Attendances

| Method | Path                                  | Role                        | Keterangan                |
| ------ | ------------------------------------- | --------------------------- | ------------------------- |
| `GET`  | `/api/v1/events/:eventId/attendances` | superadmin, admin, po (own) | Daftar absensi event      |
| `POST` | `/api/v1/events/:eventId/attendances` | superadmin, admin           | Catat absensi (idempoten) |

### Pagination dan Filter

Semua endpoint daftar mendukung query berikut:

| Query Param | Default             | Keterangan                                        |
| ----------- | ------------------- | ------------------------------------------------- |
| `page`      | `1`                 | Halaman (mulai dari 1)                            |
| `limit`     | `20`                | Jumlah item per halaman (maks 100)                |
| `order`     | `desc`              | Urutan: `asc` atau `desc`                         |
| `sortBy`    | Tergantung endpoint | Kolom pengurutan                                  |
| `q`         | -                   | Pencarian teks (tidak sensitif huruf besar/kecil) |

Contoh respons paginated:

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 134,
    "totalPages": 7
  }
}
```

---

## Role dan Hak Akses

| Role         | Ringkasan                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------- |
| `superadmin` | Semua fitur, kelola user dan role, lihat audit log                                          |
| `admin`      | Membaca data, mendaftarkan member ke event, mencatat absensi                                |
| `po`         | Membuat event, mengubah dan menghapus event miliknya, mendaftarkan member ke event miliknya |
| `executive`  | Hanya baca (divisi, member, event)                                                          |

Setiap request terautentikasi memuat ulang data user dari database (status aktif dan role terbaru), sehingga perubahan role atau penonaktifan langsung berlaku tanpa perlu login ulang.

---

## Format Respons

### Sukses

```json
{
  "data": { ... }
}
```

### Error

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Data tidak ditemukan."
  }
}
```

### Kode Error Umum

| HTTP | Code                   | Keterangan                                                         |
| ---- | ---------------------- | ------------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`     | Input tidak valid                                                  |
| 401  | `UNAUTHORIZED`         | Token tidak ada atau tidak valid                                   |
| 403  | `FORBIDDEN`            | Role atau kepemilikan tidak sesuai                                 |
| 404  | `NOT_FOUND`            | Data tidak ditemukan                                               |
| 409  | `EVENT_FULL`           | Kuota event penuh                                                  |
| 409  | `ALREADY_REGISTERED`   | Member sudah terdaftar                                             |
| 409  | `OUTSIDE_EVENT_WINDOW` | Absensi di luar jendela waktu event                                |
| 409  | `NOT_REGISTERED`       | Member belum terdaftar pada event                                  |
| 409  | `DIVISION_NOT_EMPTY`   | Divisi masih memiliki member                                       |
| 409  | `LAST_SUPERADMIN`      | Tidak dapat menonaktifkan atau menurunkan role superadmin terakhir |
| 429  | `RATE_LIMITED`         | Terlalu banyak permintaan                                          |
| 500  | `INTERNAL_ERROR`       | Kesalahan server                                                   |

---

## Deploy ke Vercel (Fastify Zero-Config)

Aplikasi ini mendukung deployment serverless ke Vercel (paket Hobby) dengan framework Fastify zero-config sesuai panduan resmi [Vercel Fastify Documentation](https://vercel.com/docs/frameworks/backend/fastify).

### Prasyarat

1. Akun [Vercel](https://vercel.com) dan [Neon](https://neon.tech).
2. Repository GitHub sudah terhubung ke akun Vercel.

### Langkah Deploy

#### 1. Buat Database Neon

1. Login ke Neon dashboard dan buat project PostgreSQL baru.
2. Salin **Connection String** yang menggunakan connection pooler (format: `postgres://user:password@ep-xyz-pooler.region.neon.tech/neondb?sslmode=require`).

#### 2. Jalankan Migrasi dan Seed dari Komputer Lokal (PowerShell)

Migrasi dan seed tidak dijalankan saat aplikasi start di Vercel. Jalankan skrip migrasi dan seed secara manual dari terminal PowerShell di komputer lokal terhadap `DATABASE_URL` Neon:

```powershell
# Set environment variable DATABASE_URL untuk sesi PowerShell saat ini
$env:DATABASE_URL="postgres://user:password@ep-xyz-pooler.region.neon.tech/neondb?sslmode=require"

# Jalankan migrasi tabel database
npm run db:migrate

# Jalankan seed akun awal di produksi
# Catatan: Saat NODE_ENV=production, seluruh SEED_*_PASSWORD wajib diisi eksplisit
# dengan password unik minimal 12 karakter (nilai contoh default di .env.example ditolak).
$env:NODE_ENV="production"
$env:SEED_SUPERADMIN_PASSWORD="SuperAdminKuat2026!"
$env:SEED_ADMIN_PASSWORD="AdminKuat2026!"
$env:SEED_EXECUTIVE_PASSWORD="ExecutiveKuat2026!"
$env:SEED_PO1_PASSWORD="PO1WebKuat2026!"
$env:SEED_PO2_PASSWORD="POMobileKuat2026!"
npm run db:seed
```

#### 3. Import Project ke Vercel

1. Di dashboard Vercel, klik **Add New > Project** dan import repository GitHub ini.
2. Vercel akan otomatis mengenali framework **Fastify** secara zero-config melalui entrypoint `src/app.ts` / `src/server.ts`.
3. Konfigurasi build dan output directory tidak perlu diubah (gunakan pengaturan default).

#### 4. Atur Environment Variables di Vercel

Tambahkan environment variables berikut di bagian **Settings > Environment Variables** di Vercel (runtime API di produksi **tidak** menuntut variabel `SEED_*_PASSWORD`):

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGINS`
- `RATE_LIMIT_MAX`
- `LOGIN_RATE_LIMIT_MAX`

#### 5. Catatan Arsitektur Vercel Serverless

- **Rate Limit:** Rate limit `@fastify/rate-limit` berjalan secara in-memory sehingga bersifat **per-instance** di lingkungan serverless Vercel (Fluid compute).
- **Connection Pooling:** Koneksi database telah dikonfigurasi dengan ukuran pool kecil (`max: 5`) dan prepared statement dinonaktifkan (`prepare: false`) agar kompatibel penuh dengan connection pooler Neon.
- **Native Dependency Bundling:** Berkas konfigurasi `vercel.json` telah menyertakan prebuild binary `argon2` agar ter-bundle dengan benar di Vercel Functions.

---

## Deploy ke Render + Neon

### Prasyarat

1. Akun [Render](https://render.com) dan [Neon](https://neon.tech).
2. Repository GitHub sudah public.

### Langkah Deploy

#### 1. Buat database Neon

1. Login ke Neon dan buat project baru.
2. Salin **Connection String** (format: `postgres://user:password@host/dbname?sslmode=require`).

#### 2. Buat Web Service di Render

1. Di Render dashboard, klik **New > Web Service**.
2. Hubungkan ke repository GitHub.
3. Konfigurasi:
   - **Runtime:** Docker
   - **Dockerfile Path:** `./Dockerfile`
   - **Region:** Pilih yang paling dekat

4. Tambahkan Environment Variables:

| Key                        | Value                                                            |
| -------------------------- | ---------------------------------------------------------------- |
| `NODE_ENV`                 | `production`                                                     |
| `PORT`                     | `3000`                                                           |
| `DATABASE_URL`             | Connection string Neon (dengan `?sslmode=require`)               |
| `JWT_SECRET`               | String acak minimal 64 karakter                                  |
| `JWT_EXPIRES_IN`           | `1h`                                                             |
| `CORS_ORIGINS`             | URL frontend yang diizinkan                                      |
| `RATE_LIMIT_MAX`           | `100`                                                            |
| `LOGIN_RATE_LIMIT_MAX`     | `5`                                                              |
| `SEED_SUPERADMIN_PASSWORD` | Password unik kuat (min 12 karakter, wajib jika seed dijalankan) |
| `SEED_ADMIN_PASSWORD`      | Password unik kuat (min 12 karakter, wajib jika seed dijalankan) |
| `SEED_EXECUTIVE_PASSWORD`  | Password unik kuat (min 12 karakter, wajib jika seed dijalankan) |
| `SEED_PO1_PASSWORD`        | Password unik kuat (min 12 karakter, wajib jika seed dijalankan) |
| `SEED_PO2_PASSWORD`        | Password unik kuat (min 12 karakter, wajib jika seed dijalankan) |

5. Deploy service. Render otomatis build dari Dockerfile dan menjalankan migrasi dan seed saat container start.

#### 3. Jalankan migrasi dan seed di produksi

Migrasi (`npm run db:migrate`) dan seed (`npm run db:seed`) sudah dikonfigurasi untuk berjalan otomatis melalui `docker-compose.yml` untuk lokal, dan harus dijalankan sekali di Render via **Shell** tab atau **Start Command** awal:

```bash
npm run db:migrate && npm run db:seed && node dist/server.js
```

#### 4. Aktifkan Keep-Alive

Layanan Render gratis tidur setelah 15 menit tidak ada lalu lintas. Gunakan [UptimeRobot](https://uptimerobot.com) atau monitor sejenis:

- Monitor URL: `https://<nama-app>.onrender.com/health`
- Interval: **5 menit**

Endpoint `/health` **tidak menyentuh database**, sehingga Neon tetap bisa berhenti sendiri (menghemat compute hours).

---

## Pengujian Otomatis

```bash
# Jalankan seluruh test suite
npm test

# Integration test (membutuhkan PostgreSQL aktif)
# Otomatis berjalan jika DATABASE_URL dapat dijangkau
npm test
```

Test suite mencakup:

- **Unit test** (110 test): Service, repository mock, HTTP route validation, role guard, auth
- **Authorization matrix** (21 test): Verifikasi seluruh kombinasi role dan kepemilikan data
- **Concurrency integration test** (3 test, butuh PostgreSQL): Kuota serentak, pendaftaran duplikat serentak, idempotensi absensi serentak

**CI/CD** via GitHub Actions berjalan otomatis pada setiap push dan pull request.

---

## Lisensi

ISC
