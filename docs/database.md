# database.md - Struktur Data Backend

Rancangan struktur data PostgreSQL untuk REST API. Agent memakainya sebagai acuan skema Drizzle dan migrasi. Perubahan hanya lewat migrasi yang direviu user. Jika ada yang kurang atau ambigu, tanyakan ke user.

Konvensi: nama tabel dan kolom bahasa Inggris, snake_case. Semua tabel punya `id` (uuid, default `gen_random_uuid()`) dan `created_at` (timestamptz, default sekarang) kecuali dinyatakan lain. Waktu disimpan sebagai `timestamptz` (UTC) dan ditampilkan API dalam format ISO 8601.

## 1. Enum

| Nama | Nilai |
|---|---|
| `user_role` | `superadmin`, `admin`, `executive`, `po` |
| `division_type` | `technical`, `non_technical` |
| `event_type` | `online`, `offline` |

## 2. Tabel

### users
Akun login. Akun bersifat akun jabatan (bukan per anggota).

| Kolom | Tipe | Keterangan |
|---|---|---|
| email | text | Disimpan huruf kecil. Unik (indeks unik pada `lower(email)`) |
| password_hash | text | Hash argon2id. Tidak pernah dikembalikan oleh API |
| full_name | text | Nama tampilan |
| role | user_role | Wajib |
| is_active | boolean | Default true. Akun nonaktif tidak bisa login dan ditolak di setiap request |
| updated_at | timestamptz | |

### divisions
| Kolom | Tipe | Keterangan |
|---|---|---|
| name | text | Unik |
| type | division_type | Technical atau non technical |

Divisi dihapus secara fisik (hard delete). Divisi hanya dapat dihapus jika tidak ada member yang menempel sama sekali, termasuk member yang di-soft-delete (409 `DIVISION_NOT_EMPTY`).

### members
| Kolom | Tipe | Keterangan |
|---|---|---|
| division_id | uuid | Relasi ke `divisions`, `ON DELETE RESTRICT` |
| full_name | text | Nama member |
| deleted_at | timestamptz | Null berarti aktif. Terisi berarti **soft delete** |
| updated_at | timestamptz | |

Soft delete menggantikan status aktif dan nonaktif pada frontend. Member yang di-soft-delete tidak muncul pada daftar bawaan, tidak bisa didaftarkan ke event baru, dan riwayat pendaftaran serta absensinya tetap tersimpan. Superadmin dapat memulihkannya.

### events
| Kolom | Tipe | Keterangan |
|---|---|---|
| name | text | Nama event |
| description | text | Boleh kosong |
| type | event_type | Online atau offline |
| start_at | timestamptz | Jam mulai |
| end_at | timestamptz | Jam selesai. Constraint: `end_at > start_at` |
| quota | int | Kuota peserta. Constraint: `quota > 0` |
| created_by | uuid | Relasi ke `users` (pemilik event). Dasar pembatasan kepemilikan data PO |
| deleted_at | timestamptz | Soft delete |
| updated_at | timestamptz | |

Event yang di-soft-delete selalu disembunyikan untuk semua role (tanpa opsi `includeDeleted`). Permintaan detail untuk event yang terhapus menjawab 404.

### event_registrations
Pendaftaran member ke event. Pembatalan pendaftaran dilakukan secara fisik (hard delete) dan dicatat ke `audit_logs` (`registration.cancelled`).

| Kolom | Tipe | Keterangan |
|---|---|---|
| event_id | uuid | Relasi ke `events` |
| member_id | uuid | Relasi ke `members`, `ON DELETE RESTRICT` |
| registered_by | uuid | Relasi ke `users` (staf yang mendaftarkan) |

**Unik pada (`event_id`, `member_id`)** untuk mencegah pendaftaran ganda di level database.

### attendances
| Kolom | Tipe | Keterangan |
|---|---|---|
| event_id | uuid | |
| member_id | uuid | |
| checked_in_at | timestamptz | Waktu check-in, default sekarang |
| recorded_by | uuid | Relasi ke `users` |

- **Unik pada (`event_id`, `member_id`)**: satu check-in per anggota per event, aman dari permintaan paralel.
- **Foreign key gabungan** (`event_id`, `member_id`) ke `event_registrations` (`event_id`, `member_id`): database sendiri menjamin absensi hanya untuk peserta terdaftar.

### audit_logs
Catatan perubahan data sensitif. Hanya ditambah (append-only): aplikasi tidak pernah mengubah atau menghapus baris.

| Kolom | Tipe | Keterangan |
|---|---|---|
| actor_id | uuid | Relasi ke `users`, `ON DELETE SET NULL` |
| actor_role | user_role | Role pelaku saat aksi terjadi |
| action | text | Misal `user.role_changed` |
| entity | text | Nama entitas, misal `user` |
| entity_id | uuid | Id entitas yang terkena |
| before | jsonb | Nilai sebelum, boleh kosong |
| after | jsonb | Nilai sesudah, boleh kosong |
| request_id | text | Untuk melacak ke log aplikasi |

Data sensitif seperti `password_hash` tidak boleh masuk `before` maupun `after`.

## 3. Indeks

- `users`: unik `lower(email)`
- `members`: `(division_id)` parsial untuk `deleted_at IS NULL`, dan `(full_name)` untuk pencarian dan sort
- `events`: `(start_at)`, `(created_by)`
- `event_registrations`: unik `(event_id, member_id)`, `(event_id)`
- `attendances`: unik `(event_id, member_id)`, `(event_id)`
- `audit_logs`: `(created_at DESC)`, `(entity, entity_id)`, `(actor_id)`

## 4. Aturan Konsistensi dan Konkurensi

### Pendaftaran event dan kuota
Kuota tidak boleh terlampaui walau banyak permintaan masuk bersamaan. Pendaftaran dikerjakan dalam **satu transaksi**:

1. Kunci baris event dengan `SELECT ... FOR UPDATE`. Permintaan lain untuk event yang sama menunggu di titik ini.
2. Hitung jumlah pendaftaran event itu. Jika sudah sama dengan `quota`, tolak dengan 409 `EVENT_FULL`.
3. Sisipkan pendaftaran. Jika melanggar keunikan, tolak dengan 409 `ALREADY_REGISTERED`.
4. Catat dan selesaikan transaksi (commit).

Keunikan (`event_id`, `member_id`) menjadi jaring pengaman terakhir untuk pendaftaran ganda. Sisa kuota = `quota` dikurangi jumlah pendaftaran, dihitung, bukan disimpan.

Aturan tambahan:
- Pendaftaran hanya dibuka sebelum `start_at`. Pembatalan pendaftaran juga hanya sebelum `start_at` dan ditolak jika sudah ada absensi.
- Kuota event tidak boleh diubah menjadi lebih kecil dari jumlah pendaftar saat ini (409).
- Event tidak bisa dihapus jika sudah punya absensi (409). Event yang dihapus adalah soft delete.

### Absensi idempotent
Check-in memakai `INSERT ... ON CONFLICT (event_id, member_id) DO NOTHING RETURNING`. Jika tidak ada baris yang dikembalikan, ambil baris yang sudah ada dan jawab sukses dengan 200, bukan membuat data ganda dan bukan error. Check-in pertama menjawab 201. Syarat sebelum insert:
- Waktu sekarang berada di antara `start_at` dan `end_at` event (jika tidak: 409 `OUTSIDE_EVENT_WINDOW`).
- Member terdaftar pada event itu (jika tidak: 409 `NOT_REGISTERED`). Foreign key gabungan menjadi penjamin di database.

### Aturan lain
- Divisi dihapus secara fisik dan tidak bisa dihapus selama masih punya member, termasuk member berstatus soft-delete (409 `DIVISION_NOT_EMPTY`). `ON DELETE RESTRICT` menjadi penjaga terakhir.
- Superadmin terakhir yang aktif tidak boleh diturunkan rolenya atau dinonaktifkan (409), termasuk oleh dirinya sendiri.
- Setiap request terautentikasi memuat user dari database, sehingga role dan status aktif selalu terbaru.
- Operasi yang mengubah lebih dari satu tabel (misalnya perubahan data beserta audit log) berjalan dalam satu transaksi.

## 5. Audit Log

Aksi yang dicatat (nilai `action`):

| Action | Kapan |
|---|---|
| `user.created` | Akun baru dibuat |
| `user.role_changed` | Role akun diubah (before dan after memuat role) |
| `user.status_changed` | Akun diaktifkan atau dinonaktifkan |
| `member.deleted` | Soft delete member |
| `member.restored` | Member dipulihkan |
| `division.deleted` | Divisi dihapus |
| `event.deleted` | Event dihapus (soft delete) |
| `registration.cancelled` | Pendaftaran dibatalkan |

Tidak semua perubahan dicatat, hanya yang sensitif. Perubahan data biasa (misalnya mengubah nama member) tidak perlu masuk audit log.

## 6. Migrasi dan Data Awal

- Migrasi dibuat dengan `drizzle-kit` dan di-commit sebagai file SQL. Dijalankan otomatis saat `docker compose up` dan saat deploy.
- **Seed (idempotent, aman dijalankan berulang):** satu akun per role dan satu akun PO tambahan untuk menguji kepemilikan data, yaitu `superadmin`, `admin`, `executive`, `po` (dua akun). Kata sandi dibaca dari environment variable, bukan ditulis di kode. Seed juga membuat beberapa divisi (technical dan non technical) dan contoh member untuk keperluan uji.
- Akun produksi dan akun reviewer memakai kata sandi berbeda dari kata sandi pengembangan.

## 7. Pertimbangan Skala (bahan PDF)

Skema ini cukup untuk ratusan anggota dan event. Jika tumbuh menjadi ribuan anggota dan event:
- Hitung kuota dengan kolom penghitung terdenormalisasi (`registered_count`) yang diperbarui dalam transaksi yang sama, supaya tidak menghitung ulang pada tiap pendaftaran.
- Pencarian nama memakai indeks `pg_trgm`.
- Pagination berbasis kursor menggantikan offset pada tabel besar.
- Audit log dipartisi per bulan.
- Pendaftaran event yang sangat ramai dapat diantrekan, dengan kunci per event tetap sebagai penjaga akhir kuota.
