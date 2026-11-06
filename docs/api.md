# api.md - Kontrak Endpoint

Kontrak REST API. Agent mengimplementasikan endpoint persis seperti di sini. Jika perlu endpoint atau perilaku di luar dokumen ini, tanyakan ke user. Dokumentasi interaktif (Swagger UI) dihasilkan otomatis dari skema Zod, dan ekspor `openapi.json` disimpan di folder `docs`.

## 1. Konvensi Umum

- **Base path:** `/api/v1`. Swagger UI di `/docs`.
- **Format:** JSON. Waktu dalam ISO 8601 (UTC). Id berupa UUID.
- **Autentikasi:** header `Authorization: Bearer <token>`, kecuali `POST /auth/login` dan endpoint health. Hanya menggunakan satu access token berumur pendek (default 1 jam melalui `JWT_EXPIRES_IN`), tanpa refresh token.
- **Respons sukses:** `{ "data": ..., "meta": ... }`. `meta` hanya ada untuk daftar.
- **Respons error:**

```json
{
  "error": {
    "code": "EVENT_FULL",
    "message": "Kuota event sudah penuh.",
    "details": null,
    "requestId": "b6f2..."
  }
}
```

`details` hanya dipakai untuk kesalahan validasi (daftar field dan pesannya). Tidak pernah memuat stack trace atau detail internal.

### Kode status

| Status | Arti | Contoh `code` |
|---|---|---|
| 200 | Berhasil | |
| 201 | Berhasil membuat data | |
| 204 | Berhasil tanpa isi | |
| 400 | Input tidak valid | `VALIDATION_ERROR` |
| 401 | Belum login atau token tidak valid | `UNAUTHORIZED` |
| 403 | Role atau kepemilikan data tidak sesuai | `FORBIDDEN` |
| 404 | Data tidak ditemukan | `NOT_FOUND` |
| 409 | Konflik aturan bisnis atau keadaan data | `EVENT_FULL`, `ALREADY_REGISTERED`, `OUTSIDE_EVENT_WINDOW`, `NOT_REGISTERED`, `DIVISION_NOT_EMPTY`, `LAST_SUPERADMIN`, `EVENT_HAS_ATTENDANCE`, `REGISTRATION_CLOSED`, `QUOTA_BELOW_REGISTERED` |
| 429 | Terlalu banyak permintaan | `RATE_LIMITED` |
| 500 | Kesalahan server (pesan umum) | `INTERNAL_ERROR` |

Pesan error ditulis dalam bahasa Indonesia, `code` dalam bahasa Inggris dan tetap.

### Pagination, filter, sort (semua daftar)

Query: `page` (mulai 1, default 1), `limit` (default 20, maksimum 100), `sortBy` (hanya dari daftar putih tiap endpoint), `order` (`asc` atau `desc`).

```json
"meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
```

Parameter yang tidak dikenal ditolak dengan 400. Pencarian (`q`) bersifat tidak peka huruf besar dan kecil, dengan karakter wildcard di-escape.

## 2. Role dan Hak Akses

| Role | Ringkasan |
|---|---|
| `superadmin` | Semua fitur, kelola user dan role, lihat audit log |
| `admin` | Membaca data, mendaftarkan member ke event, mencatat absensi |
| `po` | Membuat event, mengubah dan menghapus event **miliknya**, mendaftarkan member ke event miliknya, melihat pendaftaran dan absensi event miliknya |
| `executive` | Hanya baca (divisi, member, event). Fitur kas di luar cakupan tahap ini |

Matriks endpoint (ya = boleh, own = hanya untuk event miliknya, - = ditolak 403):

| Endpoint | superadmin | admin | po | executive |
|---|---|---|---|---|
| Login, me | ya | ya | ya | ya |
| Kelola users | ya | - | - | - |
| Audit log | ya | - | - | - |
| Divisi: baca | ya | ya | ya | ya |
| Divisi: tambah, ubah, hapus | ya | - | - | - |
| Member: baca | ya | ya | ya | ya |
| Member: tambah, ubah, hapus, pulihkan | ya | - | - | - |
| Event: baca | ya | ya | ya | ya |
| Event: tambah | ya | - | ya | - |
| Event: ubah, hapus | ya | - | own | - |
| Pendaftaran: tambah, batal | ya | ya | own | - |
| Pendaftaran: baca | ya | ya | own | - |
| Absensi: catat | ya | ya | - | - |
| Absensi: baca | ya | ya | own | - |

## 3. Endpoint

### Health (tanpa login)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Hidup atau tidak. **Tidak menyentuh database.** Dipakai monitor keep-alive |
| GET | `/health/ready` | Memeriksa koneksi database |

### Auth

| Method | Path | Keterangan |
|---|---|---|
| POST | `/auth/login` | Body `{ email, password }`. Sukses 200 `{ data: { accessToken, expiresIn, user } }`. Gagal 401 dengan pesan yang selalu sama. Rate limit ketat (429) |
| GET | `/auth/me` | Data user yang sedang login (tanpa hash password) |

### Users (superadmin)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/users` | Daftar. Filter `role`, `isActive`, `q`. Sort `fullName`, `createdAt` |
| POST | `/users` | Body `{ email, fullName, password, role }`. Password minimal 12 karakter. Dicatat `user.created` |
| PATCH | `/users/:id/role` | Body `{ role }`. Dicatat `user.role_changed`. 409 `LAST_SUPERADMIN` bila menurunkan superadmin terakhir |
| PATCH | `/users/:id/status` | Body `{ isActive }`. Dicatat `user.status_changed`. 409 `LAST_SUPERADMIN` bila menonaktifkan superadmin terakhir |

Body setiap endpoint memakai skema ketat: field di luar daftar ditolak (mencegah mass assignment). Tidak ada endpoint yang mengubah role lewat body umum.

### Audit logs (superadmin)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/audit-logs` | Filter `action`, `entity`, `actorId`, `from`, `to`. Sort `createdAt`. Hanya baca |

### Divisions

| Method | Path | Keterangan |
|---|---|---|
| GET | `/divisions` | Semua role. Filter `type`, `q`. Sort `name` |
| POST | `/divisions` | Body `{ name, type }` |
| PATCH | `/divisions/:id` | Body `{ name?, type? }` |
| DELETE | `/divisions/:id` | Penghapusan fisik (hard delete). 409 `DIVISION_NOT_EMPTY` bila masih punya member (termasuk yang di-soft-delete). Dicatat `division.deleted` |

### Members

| Method | Path | Keterangan |
|---|---|---|
| GET | `/members` | Query: `page`, `limit`, `q` (cari nama), `divisionId`, `divisionType`, `includeDeleted` (hanya superadmin), `sortBy` (`fullName`, `createdAt`), `order` |
| GET | `/members/:id` | Detail |
| POST | `/members` | Body `{ fullName, divisionId }` |
| PATCH | `/members/:id` | Body `{ fullName?, divisionId? }` |
| DELETE | `/members/:id` | **Soft delete**. 204. Dicatat `member.deleted` |
| POST | `/members/:id/restore` | Memulihkan. Dicatat `member.restored` |

### Events

| Method | Path | Keterangan |
|---|---|---|
| GET | `/events` | Query: `page`, `limit`, `q`, `type`, `from`, `to` (rentang `startAt`), `mine` (hanya event milik sendiri), `sortBy` (`startAt`, `name`, `createdAt`), `order`. Setiap item memuat `quota`, `registeredCount`, `remainingQuota`. Event yang di-soft-delete selalu disembunyikan untuk semua role (tanpa opsi `includeDeleted`) |
| GET | `/events/:id` | Detail dengan hitungan kuota. Menjawab 404 `NOT_FOUND` bila event telah di-soft-delete |
| POST | `/events` | Body `{ name, description?, type, startAt, endAt, quota }`. `endAt` harus setelah `startAt`, `quota` minimal 1. `createdBy` diisi server dari token, tidak dari body |
| PATCH | `/events/:id` | Body parsial dari field yang sama. Pemilik atau superadmin. 409 `QUOTA_BELOW_REGISTERED` bila kuota di bawah jumlah pendaftar |
| DELETE | `/events/:id` | Soft delete. Pemilik atau superadmin. 409 `EVENT_HAS_ATTENDANCE` bila sudah ada absensi. Dicatat `event.deleted` |

### Registrations (pendaftaran event)

| Method | Path | Keterangan |
|---|---|---|
| POST | `/events/:eventId/registrations` | Body `{ memberId }`. 201 bila berhasil. 409 `EVENT_FULL`, `ALREADY_REGISTERED`, `REGISTRATION_CLOSED` (event sudah dimulai). Member yang di-soft-delete ditolak. **Aman terhadap permintaan serentak** (lihat `database.md` bagian 4) |
| GET | `/events/:eventId/registrations` | Daftar peserta. Query `page`, `limit`, `q`, `sortBy` (`createdAt`, `memberName`), `order` |
| DELETE | `/events/:eventId/registrations/:memberId` | Batalkan dengan penghapusan fisik (hard delete). Hanya sebelum event dimulai dan belum ada absensi. Dicatat `registration.cancelled` |

### Attendances (absensi)

| Method | Path | Keterangan |
|---|---|---|
| POST | `/events/:eventId/attendances` | Body `{ memberId }`. **Idempotent:** check-in pertama 201, check-in berikutnya untuk pasangan yang sama 200 dengan data yang sama, tanpa data ganda. 409 `OUTSIDE_EVENT_WINDOW` di luar jam event, 409 `NOT_REGISTERED` bila member belum terdaftar |
| GET | `/events/:eventId/attendances` | Daftar yang sudah check-in. Query `page`, `limit`, `sortBy` (`checkedInAt`, `memberName`), `order` |

## 4. Aturan Otorisasi Kepemilikan Data (ringkas)

Berlaku di lapisan service, bukan hanya di route:
- PO yang bukan pemilik event mendapat **403** pada ubah, hapus, daftar, dan lihat pendaftaran atau absensi event itu.
- Superadmin dan admin tidak dibatasi kepemilikan (sesuai matriks di bagian 2).
- `createdBy`, `role`, `deletedAt`, dan `registeredBy` selalu diisi atau diubah oleh server, tidak pernah dari body.

## 5. Contoh Permintaan dan Respons

**Login**

```http
POST /api/v1/auth/login
{ "email": "superadmin@example.com", "password": "..." }
```

```json
{ "data": { "accessToken": "...", "expiresIn": 3600,
  "user": { "id": "...", "email": "superadmin@example.com", "fullName": "...", "role": "superadmin" } } }
```

**Daftar member (dengan pagination dan filter)**

```http
GET /api/v1/members?page=1&limit=20&q=ra&divisionType=technical&sortBy=fullName&order=asc
```

```json
{ "data": [ { "id": "...", "fullName": "...", "division": { "id": "...", "name": "...", "type": "technical" } } ],
  "meta": { "page": 1, "limit": 20, "total": 37, "totalPages": 2 } }
```

**Pendaftaran saat kuota penuh**

```http
POST /api/v1/events/{eventId}/registrations
{ "memberId": "..." }
```

```json
{ "error": { "code": "EVENT_FULL", "message": "Kuota event sudah penuh.", "details": null, "requestId": "..." } }
```

**Absensi berulang (idempotent)**

Permintaan pertama menjawab `201` dengan `{ "data": { "eventId": "...", "memberId": "...", "checkedInAt": "..." } }`. Permintaan yang sama berikutnya menjawab `200` dengan data yang identik.
