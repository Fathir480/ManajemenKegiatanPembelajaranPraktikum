# 📚 Manajemen Kegiatan Pembelajaran & Praktikum

Sistem web untuk mengelola kegiatan praktikum akademik dengan 4 aktor: **Admin, Dosen, Asisten, dan Praktikan**.

---

## ⚙️ Prasyarat (Wajib Diinstall di Komputer)

| Software | Versi | Link Download |
|---|---|---|
| **Node.js** | v18 ke atas | https://nodejs.org |
| **XAMPP** (MySQL) | Terbaru | https://www.apachefriends.org |
| **Git** (opsional) | Terbaru | https://git-scm.com |

> Pastikan **XAMPP sudah berjalan** dan modul **Apache + MySQL sudah aktif (hijau)** sebelum memulai.

---

## 🚀 Cara Setup (Pertama Kali)

### 1. Buat Database di phpMyAdmin

1. Buka browser → **http://localhost/phpmyadmin**
2. Klik **"New"** di sidebar kiri
3. Beri nama database: **`db_praktikum`**
4. Klik **"Create"**

> Tidak perlu import SQL secara manual — Prisma akan membuat tabelnya otomatis.

---

### 2. Setup Backend

Buka **Terminal / PowerShell**, jalankan satu per satu:

```bash
# Masuk ke folder backend
cd backend

# Install semua library yang dibutuhkan
npm install

# Sinkronisasi skema database ke MySQL
npx prisma db push

# Isi data awal (akun login semua aktor)
npm run seed
```

✅ Jika berhasil, terminal akan menampilkan:
```
🌱 Mulai seeding database...
✅ Admin dibuat
✅ Dosen dibuat
✅ Asisten dibuat
✅ Praktikan dibuat
🎉 Seeding selesai!
```

---

### 3. Setup Frontend

Buka **Terminal / PowerShell baru** (jangan tutup yang pertama), jalankan:

```bash
# Masuk ke folder frontend
cd frontend

# Install semua library yang dibutuhkan
npm install
```

---

## ▶️ Cara Menjalankan (Setiap Kali Mau Pakai)

Butuh **2 terminal yang berjalan bersamaan**:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
> Backend berjalan di: **http://localhost:5000**

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
> Frontend berjalan di: **http://localhost:5173**

Buka browser dan akses: **http://localhost:5173**

---

## 🔑 Akun Login

| Aktor | Email | Password |
|---|---|---|
| **Admin** | `admin@praktikum.ac.id` | `admin123` |
| **Dosen** | `dosen@praktikum.ac.id` | `dosen123` |
| **Asisten** | `asisten@praktikum.ac.id` | `asisten123` |
| **Praktikan** | `mahasiswa@praktikum.ac.id` | `mahasiswa123` |

---

## 📁 Struktur Folder

```
ManajemenKegiatanPeaktikum/
├── backend/          ← API Server (Express.js + Prisma)
│   ├── prisma/       ← Skema & seed database
│   ├── src/
│   │   ├── routes/   ← Endpoint API per aktor
│   │   ├── middleware/
│   │   └── index.js  ← Entry point server
│   └── .env          ← Konfigurasi database & JWT
│
├── frontend/         ← Tampilan Web (React + Vite)
│   ├── src/
│   │   ├── pages/    ← Halaman per aktor
│   │   ├── components/
│   │   └── lib/      ← Utility (API client, auth)
│   └── index.html
│
├── db_praktikum.sql  ← Referensi skema database
└── README.md
```

---

## ❗ Troubleshooting

**Problem: `npx prisma db push` gagal / error koneksi**
- Pastikan XAMPP → MySQL sudah aktif (tombol **Start** di XAMPP Control Panel)
- Buka file `backend/.env` dan pastikan isinya:
  ```
  DATABASE_URL="mysql://root:@localhost:3306/db_praktikum"
  ```
  Jika MySQL Anda punya password, ubah menjadi:
  ```
  DATABASE_URL="mysql://root:PASSWORD_ANDA@localhost:3306/db_praktikum"
  ```

**Problem: `npm install` lambat atau error**
- Coba hapus folder `node_modules` lalu jalankan `npm install` ulang

**Problem: Port sudah dipakai**
- Backend pakai port `5000`, pastikan tidak ada aplikasi lain yang menggunakannya
- Frontend pakai port `5173`

**Problem: Halaman putih / error di browser**
- Pastikan backend sudah berjalan dulu sebelum membuka frontend
- Buka DevTools browser (F12) → tab Console untuk melihat pesan error

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS (Design System Custom) |
| Backend | Node.js + Express.js |
| Database | MySQL |
| ORM | Prisma |
| Auth | JWT (JSON Web Token) |
| QR Code | Library `qrcode` |
