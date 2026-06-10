-- ============================================================
--  DATABASE: Manajemen Kegiatan Pembelajaran & Praktikum
--  Aktor   : Admin, Asisten, Dosen, Praktikan
-- ============================================================

CREATE DATABASE IF NOT EXISTS db_praktikum
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_praktikum;

-- ============================================================
-- 1. PENGGUNA & AUTENTIKASI
-- ============================================================

CREATE TABLE roles (
  id         TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama_role  ENUM('admin','dosen','asisten','praktikan') NOT NULL UNIQUE
);

INSERT INTO roles (nama_role) VALUES
  ('admin'), ('dosen'), ('asisten'), ('praktikan');

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id       TINYINT UNSIGNED NOT NULL,
  nama          VARCHAR(120)     NOT NULL,
  email         VARCHAR(160)     NOT NULL UNIQUE,
  password_hash VARCHAR(255)     NOT NULL,
  foto_profil   VARCHAR(255)     NULL,
  aktif         TINYINT(1)       NOT NULL DEFAULT 1,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ============================================================
-- 2. DATA AKADEMIK
-- ============================================================

-- Mahasiswa (Praktikan)
CREATE TABLE mahasiswa (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL UNIQUE,
  stambuk     VARCHAR(20)  NOT NULL UNIQUE COMMENT 'NIM / stambuk, diset oleh admin',
  angkatan    YEAR         NOT NULL,
  program_studi VARCHAR(80) NULL,
  CONSTRAINT fk_mhs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Dosen
CREATE TABLE dosen (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id   INT UNSIGNED NOT NULL UNIQUE,
  nid       VARCHAR(20)  NOT NULL UNIQUE COMMENT 'Nomor Induk Dosen, diset oleh admin',
  spesialisasi VARCHAR(100) NULL,
  CONSTRAINT fk_dosen_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Asisten
CREATE TABLE asisten (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id  INT UNSIGNED NOT NULL UNIQUE,
  stambuk  VARCHAR(20)  NOT NULL,
  CONSTRAINT fk_asisten_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mata Kuliah / Praktikum
CREATE TABLE mata_kuliah (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode          VARCHAR(20)  NOT NULL UNIQUE,
  nama          VARCHAR(150) NOT NULL,
  sks           TINYINT UNSIGNED NOT NULL DEFAULT 2,
  tipe          ENUM('kuliah','praktikum','keduanya') NOT NULL DEFAULT 'keduanya',
  deskripsi     TEXT         NULL,
  aktif         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pengampu: Dosen ↔ Mata Kuliah
CREATE TABLE pengampu (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dosen_id      INT UNSIGNED NOT NULL,
  mata_kuliah_id INT UNSIGNED NOT NULL,
  semester      VARCHAR(12)  NOT NULL COMMENT 'e.g. 2024/2025 Ganjil',
  UNIQUE KEY uq_pengampu (dosen_id, mata_kuliah_id, semester),
  CONSTRAINT fk_pengampu_dosen FOREIGN KEY (dosen_id)       REFERENCES dosen(id),
  CONSTRAINT fk_pengampu_mk    FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id)
);

-- Kelas
CREATE TABLE kelas (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama_kelas     VARCHAR(50)      NOT NULL,
  mata_kuliah_id INT UNSIGNED      NOT NULL,
  dosen_id       INT UNSIGNED      NOT NULL,
  semester       VARCHAR(50)      NOT NULL,
  aktif          TINYINT(1)       NOT NULL DEFAULT 1,
  created_at     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kelas (nama_kelas, mata_kuliah_id, semester),
  CONSTRAINT fk_kelas_dosen FOREIGN KEY (dosen_id) REFERENCES dosen(id) ON UPDATE CASCADE,
  CONSTRAINT fk_kelas_mk FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id) ON UPDATE CASCADE
);

-- Peserta Kelas (KRS)
CREATE TABLE peserta_kelas (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kelas_id     INT UNSIGNED NOT NULL,
  mahasiswa_id INT UNSIGNED NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peserta_kelas (kelas_id, mahasiswa_id),
  CONSTRAINT fk_pk_kelas FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pk_mhs   FOREIGN KEY (mahasiswa_id) REFERENCES mahasiswa(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================
-- 3. JADWAL PRAKTIKUM
-- ============================================================

CREATE TABLE ruangan (
  id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode  VARCHAR(20)  NOT NULL UNIQUE,
  nama  VARCHAR(80)  NOT NULL,
  kapasitas SMALLINT UNSIGNED NULL
);

CREATE TABLE jadwal_praktikum (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mata_kuliah_id INT UNSIGNED  NOT NULL,
  asisten_id     INT UNSIGNED  NULL COMMENT 'Asisten penanggung jawab sesi',
  ruangan_id     INT UNSIGNED  NULL,
  hari           ENUM('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu') NOT NULL,
  jam_mulai      TIME          NOT NULL,
  jam_selesai    TIME          NOT NULL,
  semester       VARCHAR(12)   NOT NULL,
  kapasitas_grup TINYINT UNSIGNED NOT NULL DEFAULT 30,
  aktif          TINYINT(1)    NOT NULL DEFAULT 1,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kelas          VARCHAR(10)   NULL,
  kelas_id       INT UNSIGNED  NULL,
  CONSTRAINT fk_jadwal_mk      FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id),
  CONSTRAINT fk_jadwal_asisten FOREIGN KEY (asisten_id)     REFERENCES asisten(id) ON DELETE SET NULL,
  CONSTRAINT fk_jadwal_ruangan FOREIGN KEY (ruangan_id)     REFERENCES ruangan(id) ON DELETE SET NULL,
  CONSTRAINT fk_jadwal_kelas   FOREIGN KEY (kelas_id)       REFERENCES kelas(id) ON DELETE SET NULL ON UPDATE CASCADE
);


-- Pendaftaran Praktikan ke Jadwal
CREATE TABLE peserta_jadwal (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jadwal_id   INT UNSIGNED NOT NULL,
  mahasiswa_id INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_peserta (jadwal_id, mahasiswa_id),
  CONSTRAINT fk_pj_jadwal FOREIGN KEY (jadwal_id)    REFERENCES jadwal_praktikum(id),
  CONSTRAINT fk_pj_mhs    FOREIGN KEY (mahasiswa_id) REFERENCES mahasiswa(id)
);

-- ============================================================
-- 4. PERPINDAHAN JADWAL
-- ============================================================

CREATE TABLE ajuan_pindah_jadwal (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pengaju_id      INT UNSIGNED NOT NULL COMMENT 'user_id pengaju (asisten atau dosen)',
  jadwal_asal_id  INT UNSIGNED NOT NULL,
  jadwal_tujuan_id INT UNSIGNED NOT NULL,
  alasan          TEXT         NOT NULL,
  status          ENUM('menunggu','disetujui','ditolak') NOT NULL DEFAULT 'menunggu',
  catatan_admin   TEXT         NULL,
  diproses_oleh   INT UNSIGNED NULL COMMENT 'user_id admin yang memvalidasi',
  diproses_pada   TIMESTAMP    NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_apj_pengaju  FOREIGN KEY (pengaju_id)       REFERENCES users(id),
  CONSTRAINT fk_apj_asal     FOREIGN KEY (jadwal_asal_id)   REFERENCES jadwal_praktikum(id),
  CONSTRAINT fk_apj_tujuan   FOREIGN KEY (jadwal_tujuan_id) REFERENCES jadwal_praktikum(id),
  CONSTRAINT fk_apj_admin    FOREIGN KEY (diproses_oleh)    REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- 5. ABSENSI
-- ============================================================

CREATE TABLE sesi_praktikum (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jadwal_id    INT UNSIGNED  NOT NULL,
  tanggal      DATE          NOT NULL,
  pertemuan_ke TINYINT UNSIGNED NOT NULL DEFAULT 1,
  topik        VARCHAR(200)  NULL,
  dibuka_oleh  INT UNSIGNED  NULL COMMENT 'asisten user_id',
  dibuka_pada  TIMESTAMP     NULL,
  ditutup_pada TIMESTAMP     NULL,
  qr_token     VARCHAR(64)   NULL UNIQUE COMMENT 'Token untuk scan QR absensi',
  UNIQUE KEY uq_sesi (jadwal_id, tanggal, pertemuan_ke),
  CONSTRAINT fk_sesi_jadwal FOREIGN KEY (jadwal_id)   REFERENCES jadwal_praktikum(id),
  CONSTRAINT fk_sesi_asisten FOREIGN KEY (dibuka_oleh) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE absensi (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sesi_id       INT UNSIGNED NOT NULL,
  mahasiswa_id  INT UNSIGNED NOT NULL,
  status        ENUM('hadir','izin','sakit','alpa') NOT NULL DEFAULT 'alpa',
  metode        ENUM('manual','qr_scan') NOT NULL DEFAULT 'manual',
  waktu_absen   TIMESTAMP    NULL,
  keterangan    VARCHAR(200) NULL,
  dicatat_oleh  INT UNSIGNED NULL COMMENT 'asisten user_id jika manual',
  UNIQUE KEY uq_absensi (sesi_id, mahasiswa_id),
  CONSTRAINT fk_abs_sesi FOREIGN KEY (sesi_id)      REFERENCES sesi_praktikum(id),
  CONSTRAINT fk_abs_mhs  FOREIGN KEY (mahasiswa_id) REFERENCES mahasiswa(id),
  CONSTRAINT fk_abs_asisten FOREIGN KEY (dicatat_oleh) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- 6. NILAI
-- ============================================================

CREATE TABLE komponen_nilai (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mata_kuliah_id INT UNSIGNED     NOT NULL,
  nama           VARCHAR(80)      NOT NULL COMMENT 'e.g. Asistensi, Laporan, UTS, UAS',
  kategori       ENUM('praktikum','asistensi','uts','uas','tugas','lainnya') NOT NULL,
  bobot          DECIMAL(5,2)     NOT NULL DEFAULT 0.00 COMMENT 'Bobot dalam persen, total harus 100',
  diinput_oleh   ENUM('asisten','dosen') NOT NULL,
  UNIQUE KEY uq_komponen (mata_kuliah_id, nama),
  CONSTRAINT fk_kn_mk FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id)
);

CREATE TABLE nilai (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mahasiswa_id     INT UNSIGNED    NOT NULL,
  komponen_id      INT UNSIGNED    NOT NULL,
  sesi_id          INT UNSIGNED    NULL COMMENT 'Terkait sesi tertentu jika praktikum/asistensi',
  nilai            DECIMAL(5,2)    NOT NULL,
  catatan          VARCHAR(200)    NULL,
  diinput_oleh     INT UNSIGNED    NOT NULL COMMENT 'user_id asisten atau dosen',
  diinput_pada     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_nilai (mahasiswa_id, komponen_id, sesi_id),
  CONSTRAINT fk_nilai_mhs       FOREIGN KEY (mahasiswa_id) REFERENCES mahasiswa(id),
  CONSTRAINT fk_nilai_komponen  FOREIGN KEY (komponen_id)  REFERENCES komponen_nilai(id),
  CONSTRAINT fk_nilai_sesi      FOREIGN KEY (sesi_id)       REFERENCES sesi_praktikum(id) ON DELETE SET NULL,
  CONSTRAINT fk_nilai_inputor   FOREIGN KEY (diinput_oleh)  REFERENCES users(id)
);

-- Rekap Nilai Akhir (dihitung/di-cache per semester)
CREATE TABLE rekap_nilai_akhir (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mahasiswa_id   INT UNSIGNED   NOT NULL,
  mata_kuliah_id INT UNSIGNED   NOT NULL,
  semester       VARCHAR(12)    NOT NULL,
  nilai_praktikum DECIMAL(5,2)  NULL,
  nilai_asistensi DECIMAL(5,2)  NULL,
  nilai_uts       DECIMAL(5,2)  NULL,
  nilai_uas       DECIMAL(5,2)  NULL,
  nilai_akhir     DECIMAL(5,2)  NULL,
  grade           CHAR(2)       NULL COMMENT 'A, B+, B, C+, C, D, E',
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rekap (mahasiswa_id, mata_kuliah_id, semester),
  CONSTRAINT fk_rna_mhs FOREIGN KEY (mahasiswa_id)   REFERENCES mahasiswa(id),
  CONSTRAINT fk_rna_mk  FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id)
);

-- ============================================================
-- 7. MATERI & MODUL (Upload oleh Dosen)
-- ============================================================

CREATE TABLE materi (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mata_kuliah_id INT UNSIGNED NOT NULL,
  dosen_id       INT UNSIGNED NOT NULL,
  judul          VARCHAR(200) NOT NULL,
  deskripsi      TEXT         NULL,
  tipe           ENUM('modul','materi','referensi','lainnya') NOT NULL DEFAULT 'materi',
  file_path      VARCHAR(255) NOT NULL,
  ukuran_kb      INT UNSIGNED NULL,
  semester       VARCHAR(12)  NOT NULL,
  published_at   TIMESTAMP    NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_materi_mk    FOREIGN KEY (mata_kuliah_id) REFERENCES mata_kuliah(id),
  CONSTRAINT fk_materi_dosen FOREIGN KEY (dosen_id)       REFERENCES dosen(id)
);

-- ============================================================
-- 8. LOG AKTIVITAS (Audit Trail)
-- ============================================================

CREATE TABLE log_aktivitas (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED  NULL,
  aksi       VARCHAR(80)   NOT NULL COMMENT 'e.g. LOGIN, INPUT_NILAI, SCAN_QR',
  entitas    VARCHAR(60)   NULL COMMENT 'Tabel terkait, e.g. absensi, nilai',
  entitas_id INT UNSIGNED  NULL,
  deskripsi  TEXT          NULL,
  ip_address VARCHAR(45)   NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- CONTOH DATA AWAL (Seed)
-- ============================================================

-- Roles sudah di-insert di atas.

-- Contoh mata kuliah
INSERT INTO mata_kuliah (kode, nama, sks, tipe) VALUES
  ('MK001', 'Pemrograman Web', 3, 'keduanya'),
  ('MK002', 'Basis Data', 3, 'keduanya'),
  ('MK003', 'Jaringan Komputer', 3, 'keduanya');

-- Ruangan
INSERT INTO ruangan (kode, nama, kapasitas) VALUES
  ('LAB-A', 'Lab Komputer A', 30),
  ('LAB-B', 'Lab Komputer B', 30),
  ('LAB-C', 'Lab Jaringan', 25);
