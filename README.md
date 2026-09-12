# TEN SSO — Centralized Identity & Access Management Infrastructure

Infrastruktur **Single Sign-On (SSO)** resmi untuk ekosistem **TEN-MY-ID**. Dibangun menggunakan **Next.js (App Router)**, **Firebase Authentication (Email & Password)**, **Cloud Firestore**, dan **Cloudflare Wrangler**.

Sistem ini berfungsi sebagai *Single Source of Truth*: akun pengguna dibuat, diedit, dinonaktifkan, dihapus, diautentikasi, dan diotorisasi ke seluruh aplikasi ekosistem hanya melalui sistem ini.

---

## 🌟 Fitur Utama & Modul

1. **Autentikasi Terpadu (`/auth/*`)**
   - **Login (`/auth/login`)**: Autentikasi email & password via Firebase Auth, mendukung alur redirect SSO (`client_id`, `redirect_uri`).
   - **Register (`/auth/register`)**: Pendaftaran akun SSO baru dengan sinkronisasi instan ke Firestore `users/{uid}`.
   - **Lupa Kata Sandi (`/auth/forgot-password`)**: Permintaan tautan pemulihan email.
   - **Reset Kata Sandi (`/auth/reset-password`)**: Pembaruan kata sandi baru dengan kode verifikasi `oobCode`.

2. **Portal Pengguna & Administrator**
   - **Portal User (`/portal`)**: Dashboard pengguna terpadu dengan fitur *App Launcher* 1-klik SSO ke aplikasi-aplikasi terdaftar, status identitas, dan informasi sesi login aktif.
   - **Portal Admin (`/admin`)**: Monitoring pusat kesehatan SSO, metrik total pengguna, aplikasi terdaftar, katalog peran & izin, serta riwayat *audit trail* terkini.

3. **Modul Pengelolaan Akun & Hak Akses**
   - **Akun (`/account`)**: Manajemen profil identitas (Nama, Organisasi, Jabatan, Telepon) dan penggantian kata sandi langsung.
   - **Pengguna (`/users`)**: CRUD akun pengguna lengkap (tambah pengguna baru oleh admin, edit data, ubah status active/suspended, dan hapus akun permanen).
   - **Aplikasi (`/apps`)**: Manajemen OAuth2 Clients (Client ID, Client Secret, whitelist Redirect URIs, dan allowed scopes).
   - **Peran (`/roles`)**: RBAC terstruktur untuk mengatur peran sistem (Superadmin, Admin, Member, dll.) dan pemetaan izin.
   - **Hak Akses (`/permissions`)**: Katalog izin granular sistem (Users, Roles, Apps, SSO, Settings, Audit).
   - **Pengaturan (`/settings`)**: Konfigurasi global SSO, kebijakan pendaftaran mandiri, durasi sesi, dan whitelist domain.

4. **SSO OAuth2 Engine (`/api/oauth/*`)**
   - `GET /api/oauth/authorize`: Endpoint otorisasi SSO untuk aplikasi eksternal.
   - `POST /api/oauth/token`: Endpoint penukaran kode otorisasi menjadi Access Token (JWT terenkripsi dengan `jose`).
   - `GET /api/oauth/userinfo`: Endpoint verifikasi token dan pengembalian profil identitas standar.

---

## 🚀 Panduan Menjalankan Secara Lokal

### 1. Salin Environment Variables
```bash
cp .env.example .env.local
```

Isi konfigurasi Firebase Client Anda dari **Firebase Console > Project Settings > General > Your apps**:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=account-ten-my-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=account-ten-my-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=account-ten-my-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=1:...
SSO_JWT_SECRET=rahasia-jwt-minimal-32-karakter
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Catatan:** Sistem telah dilengkapi *zero-config resilient fallback* di mana Anda dapat langsung menguji login, register, dan seluruh antarmuka admin/user tanpa error bahkan sebelum mengisi kredensial Firebase asli!

### 2. Jalankan Mode Development
```bash
npm run dev
```
Buka browser di `http://localhost:3000`.

### 3. Build & Typecheck
```bash
npm run build
```

---

## ☁️ Deployment ke Cloudflare menggunakan Wrangler

Aplikasi ini telah dikonfigurasi dengan `wrangler.jsonc` untuk deployment ke Cloudflare:

```bash
# Login ke Cloudflare
npx wrangler login

# Deploy ke Cloudflare Pages
npx wrangler pages deploy .next
```

---

## 🎨 Desain Antarmuka

Antarmuka dirancang dengan standar profesional bertema **minimalis terang (*clean light theme*)**:
- Tipografi tajam dengan Geist Sans & Geist Mono
- Border halus bernuansa slate (`#e2e8f0`) dengan kartu putih bersih (`#ffffff`)
- Status badge kontras dan elegan
- Micro-interactions responsif di seluruh tombol dan formulir.
