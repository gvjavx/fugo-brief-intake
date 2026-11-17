# Fugo Brief Desk

MVP tool internal Fugo Creative: calon klien mengisi brief proyek, Gemini merangkum dan memberi prioritas, tim sales memantau semuanya dari dashboard.

- **Live:** _(diisi setelah deploy)_
- **Admin:** kredensial dikirim lewat email balasan

## Menjalankan secara lokal

Butuh Node 22+ dan Docker.

```bash
npm install
cp .env.example .env          # isi GEMINI_API_KEY
docker compose up -d db       # Postgres di localhost:55432
npm run db:migrate
npm run dev                   # web http://localhost:5173, API http://localhost:4010
```

Atau semuanya di Docker: `GEMINI_API_KEY=... docker compose up`, lalu buka http://localhost:5173.

```bash
npm test          # vitest: validasi output AI, validasi form, proteksi route admin
npm run typecheck
```

### Environment variables

| Nama | Keterangan |
| --- | --- |
| `DATABASE_URL` | Connection string Postgres |
| `GEMINI_API_KEY` | API key Google AI Studio |
| `GEMINI_MODEL` | Default `gemini-2.5-flash` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Satu akun admin dashboard |
| `SESSION_SECRET` | Kunci tanda tangan cookie sesi (JWT) |

## Arsitektur

```
src/       React SPA (Vite): form publik, login, dashboard, detail brief
shared/    Schema zod yang dipakai frontend dan backend
server/    Express API, akses Postgres, integrasi Gemini, auth
api/       Entry point Vercel Function (mengekspor app Express)
tests/     Vitest + supertest
```

Satu repo, satu deploy di Vercel: build Vite disajikan sebagai file statis, semua `/api/*` diarahkan ke satu Vercel Function berisi Express.

**Alur brief:**

1. `POST /api/briefs` memvalidasi input dengan `briefInputSchema` (zod), menyimpan ke Postgres dengan `ai_status = pending`, lalu langsung membalas `201`. Form tidak menunggu LLM.
2. Pemrosesan AI dijalankan lewat `waitUntil` (`@vercel/functions`): function tetap hidup sampai Gemini selesai walau respons sudah terkirim. Saat dijalankan lokal, promise berjalan biasa di proses Node.
3. `claimForProcessing` mengubah status ke `processing` dengan `UPDATE ... WHERE ai_status <> 'processing'` agar dua proses tidak mengerjakan brief yang sama. Klaim yang lebih tua dari 2 menit dianggap macet (misalnya function terbunuh), jadi masih bisa diproses ulang.
4. Hasil Gemini di-parse dan divalidasi dengan `aiResultSchema`. Jika valid: `done` + `ai_result`. Jika gagal, timeout (25 detik), atau tidak sesuai schema: `failed` + `ai_error`, brief tetap tersimpan.
5. Dashboard melakukan polling setiap 2–3 detik hanya selama ada brief berstatus `pending`/`processing`.

### Skema database

Satu tabel `briefs` (`server/schema.sql`):

| Kolom | Catatan |
| --- | --- |
| `name, email, company, needs, budget, timeline` | Data asli dari form |
| `pipeline_status` | `new / contacted / proposal / won / lost` (CHECK constraint) |
| `ai_status` | `pending / processing / done / failed` |
| `ai_result` | `jsonb`, hasil Gemini yang sudah lolos validasi |
| `ai_error, ai_attempts, ai_model` | Untuk debugging dan tombol proses ulang |
| `priority, service_category` | Generated column dari `ai_result`, diindeks untuk filter |

### Schema hasil AI

Sesuai brief, ditambah `reply_draft` (draft email balasan, fitur nilai tambah):

```json
{
  "summary": "string",
  "service_category": "Branding | Website | Mobile App | AI Automation | Social Media | Lainnya",
  "priority": "High | Medium | Low",
  "priority_reason": "string",
  "missing_info": ["string"],
  "reply_draft": "string"
}
```

Schema zod yang sama diubah ke JSON Schema (`z.toJSONSchema`) dan dikirim ke Gemini sebagai `responseJsonSchema`, lalu dipakai lagi untuk memvalidasi jawabannya. Schema yang diminta ke model dan yang divalidasi tidak bisa berbeda.

### API

| Method | Path | Auth |
| --- | --- | --- |
| `POST` | `/api/briefs` | publik |
| `POST` | `/api/auth/login`, `/api/auth/logout` | publik |
| `GET` | `/api/auth/me` | sesi |
| `GET` | `/api/admin/briefs?priority=&category=` | sesi |
| `GET` | `/api/admin/briefs/:id` | sesi |
| `PATCH` | `/api/admin/briefs/:id/status` | sesi |
| `POST` | `/api/admin/briefs/:id/reprocess` | sesi |

## Keputusan teknis dan trade-off

- **React + Express di Vercel, bukan Next.js.** React dipilih untuk frontend, dan API Express dibuat terpisah tapi tetap di repo dan deploy yang sama. Trade-off: perlu `vercel.json` untuk rewrite, dan Express berjalan sebagai satu function, sehingga cold start mencakup seluruh API.
- **`waitUntil` untuk async, bukan queue.** Tidak perlu Redis atau worker tambahan untuk MVP. Batasannya: jika function mati di tengah proses, tidak ada retry otomatis. Brief akan terlihat `processing`, lalu bisa diproses ulang manual setelah 2 menit. Untuk volume besar, ganti dengan queue (misalnya Vercel Queues atau pg-boss).
- **`pg` + SQL mentah, bukan ORM.** Hanya satu tabel dan enam query. Schema ada di satu file SQL yang idempotent (`CREATE ... IF NOT EXISTS`), tanpa tool migrasi.
- **Admin dari env, bukan tabel user.** Brief meminta satu akun. Password dibandingkan dengan `timingSafeEqual` atas hash SHA-256. Sesi berupa JWT di cookie `httpOnly`, `SameSite=Lax`, `Secure` di production, berlaku 12 jam.
- **Prioritas tidak bergantung warna.** Ditampilkan sebagai titik (●●○) + teks, supaya tetap terbaca oleh pengguna buta warna dan di dark mode.
- **Belum ada:** rate limit login, pagination (list dibatasi 200 brief terbaru), notifikasi ke sales saat brief masuk, dan edit hasil AI secara manual.

## AI usage log

**Tools:** Claude Code (Claude Opus 5.5) di terminal, termasuk Claude in Chrome untuk membaca brief dan menguji UI di browser.

**Dipakai untuk:**

- Menyusun struktur proyek, schema zod, schema SQL, route Express, dan halaman React.
- Membaca deklarasi tipe `@google/genai` untuk memastikan field `responseJsonSchema`, `systemInstruction`, dan `abortSignal` memang ada sebelum dipakai.
- Menulis test dan menjalankan smoke test API ke Postgres lokal.
- Menguji form, login, dan dashboard di Chrome.

**Saat output AI saya koreksi atau tolak:**

1. **Nilai budget memakai en dash (`Rp10–25 juta`).** AI menulisnya dengan tanda `–`. Saat diuji dengan curl di Windows, request selalu ditolak `Pilih salah satu rentang budget` karena karakter itu rusak di jalur shell. Nilai enum yang lewat API saya ganti ke ASCII (`Rp10-25 juta`).
2. **`aria-invalid` dipasang di `<div>` pembungkus.** Versi pertama komponen `Field` menaruh `aria-invalid` dan `aria-describedby` di div, bukan di input, sehingga screen reader tidak membacakan error. Diperbaiki dengan `cloneElement` agar atribut masuk ke input.
3. **Pesan error yang menyesatkan.** Field email dan tanggal yang kosong menampilkan "Format email tidak valid" dan "Tanggal tidak valid". Terlihat saat uji submit form kosong di browser. Diperbaiki dengan `min(1, '... wajib diisi')` sebelum validasi format.
4. **Class CSS bertabrakan.** `.ai-failed` dipakai untuk label status di tabel dan kotak error di halaman detail, sehingga label di tabel ikut berlatar pink. Terlihat saat uji di browser, lalu class kotaknya diganti `.ai-failed-box`.
5. **Port bentrok.** Postgres Docker di 5432 dan API di 3001 bentrok dengan service lain di mesin saya. Request "berhasil" tapi ditangani proses lain, terlihat dari respons HTML bawaan Express padahal app ini membalas JSON. Port dipindah ke 55432 dan 4010.
