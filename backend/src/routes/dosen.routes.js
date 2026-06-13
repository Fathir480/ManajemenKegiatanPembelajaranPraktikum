const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, authorize('dosen'));

// Konfigurasi upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/materi');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.pptx', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Tipe file tidak diizinkan. Hanya PDF, DOCX, PPTX, XLSX.'));
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // Max 20MB
});

// GET mata kuliah yang diampu dosen
router.get('/matkul', async (req, res) => {
  try {
    const dosen = await prisma.dosen.findUnique({ where: { userId: req.user.id } });
    if (!dosen) return res.status(404).json({ message: 'Data dosen tidak ditemukan.' });

    const pengampu = await prisma.pengampu.findMany({
      where: { dosenId: dosen.id },
      include: { mataKuliah: true },
    });
    res.json(pengampu.map(p => p.mataKuliah));
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil mata kuliah.' });
  }
});

// GET absensi kelas (read-only matrix)
router.get('/absensi/kelas/:kelasId', async (req, res) => {
  try {
    const kelasId = parseInt(req.params.kelasId);
    
    // Ambil detail kelas
    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      include: { mataKuliah: true }
    });
    if (!kelas) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    // Ambil semua mahasiswa di kelas ini
    const peserta = await prisma.pesertaKelas.findMany({
      where: { kelasId },
      include: {
        mahasiswa: {
          include: { user: { select: { nama: true } } }
        }
      },
      orderBy: { mahasiswa: { stambuk: 'asc' } }
    });

    // Ambil semua sesi praktikum yang berkaitan dengan kelas ini
    const sesi = await prisma.sesiPraktikum.findMany({
      where: {
        jadwal: { kelasId }
      },
      orderBy: [
        { pertemuanKe: 'asc' },
        { tanggal: 'asc' }
      ]
    });

    const sesiIds = sesi.map(s => s.id);

    // Ambil data absensi untuk sesi-sesi tersebut
    let absensi = [];
    if (sesiIds.length > 0) {
      absensi = await prisma.absensi.findMany({
        where: {
          sesiId: { in: sesiIds }
        }
      });
    }

    res.json({
      kelas,
      students: peserta.map(p => ({
        id: p.mahasiswa.id,
        nama: p.mahasiswa.user.nama,
        stambuk: p.mahasiswa.stambuk
      })),
      sessions: sesi,
      attendance: absensi
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data absensi.', error: error.message });
  }
});

// GET semua komponen nilai per mata kuliah
router.get('/komponen/:mataKuliahId', async (req, res) => {
  try {
    const komponen = await prisma.komponenNilai.findMany({
      where: { mataKuliahId: parseInt(req.params.mataKuliahId) },
    });
    res.json(komponen);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil komponen nilai.', error: error.message });
  }
});

// GET kelas yang diampu dosen
router.get('/kelas', async (req, res) => {
  try {
    const dosen = await prisma.dosen.findUnique({ where: { userId: req.user.id } });
    if (!dosen) return res.status(404).json({ message: 'Data dosen tidak ditemukan.' });

    // Dapatkan semua kelas yang diajar oleh dosen ini (baik melalui Kelas.dosenId, JadwalPraktikum.dosenId, atau Pengampu)
    const kelas = await prisma.kelas.findMany({
      where: {
        OR: [
          { dosenId: dosen.id },
          { jadwalPraktikum: { some: { dosenId: dosen.id } } },
          { mataKuliah: { pengampu: { some: { dosenId: dosen.id } } } }
        ]
      },
      include: {
        mataKuliah: true
      }
    });

    res.json(kelas);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil kelas dosen.', error: error.message });
  }
});

// GET nilai matriks kelas (seperti admin)
router.get('/nilai/kelas/:kelasId', async (req, res) => {
  try {
    const kelasId = parseInt(req.params.kelasId);
    
    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      include: {
        mataKuliah: true,
      }
    });
    
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });

    let komponen = await prisma.komponenNilai.findMany({
      where: { mataKuliahId: kelas.mataKuliahId },
      orderBy: { id: 'asc' }
    });

    // Auto-generate standard components if none exist
    if (komponen.length === 0) {
      const defaultComponents = [
        { nama: 'Praktikum 1', bobot: 5, kategori: 'praktikum', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'Praktikum 2', bobot: 5, kategori: 'praktikum', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'Praktikum 3', bobot: 5, kategori: 'praktikum', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'Praktikum 4', bobot: 5, kategori: 'praktikum', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'Praktikum 5', bobot: 5, kategori: 'praktikum', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'Praktikum 6', bobot: 5, kategori: 'praktikum', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'Asistensi 1', bobot: 5, kategori: 'asistensi', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'Asistensi 2', bobot: 5, kategori: 'asistensi', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'Asistensi 3', bobot: 5, kategori: 'asistensi', diinputOleh: 'asisten', mataKuliahId: kelas.mataKuliahId },
        { nama: 'UTS', bobot: 25, kategori: 'uts', diinputOleh: 'dosen', mataKuliahId: kelas.mataKuliahId },
        { nama: 'UAS', bobot: 30, kategori: 'uas', diinputOleh: 'dosen', mataKuliahId: kelas.mataKuliahId }
      ];
      await prisma.komponenNilai.createMany({ data: defaultComponents });
      
      komponen = await prisma.komponenNilai.findMany({
        where: { mataKuliahId: kelas.mataKuliahId },
        orderBy: { id: 'asc' }
      });
    }

    const peserta = await prisma.pesertaKelas.findMany({
      where: { kelasId },
      include: {
        mahasiswa: {
          include: {
            user: { select: { nama: true } }
          }
        }
      },
      orderBy: { mahasiswa: { stambuk: 'asc' } }
    });

    const mahasiswaIds = peserta.map(p => p.mahasiswaId);
    
    const nilai = await prisma.nilai.findMany({
      where: {
        mahasiswaId: { in: mahasiswaIds },
        komponen: { mataKuliahId: kelas.mataKuliahId }
      },
      include: {
        komponen: { select: { nama: true, kategori: true } }
      }
    });

    const formattedStudents = peserta.map(p => {
      const mhs = p.mahasiswa;
      const nilaiMhs = nilai.filter(n => n.mahasiswaId === mhs.id);
      
      return {
        id: mhs.id,
        stambuk: mhs.stambuk,
        nama: mhs.user.nama,
        nilai: nilaiMhs.map(n => ({
          komponenId: n.komponenId,
          nilai: n.nilai,
          kategori: n.komponen.kategori,
          namaKomponen: n.komponen.nama
        }))
      };
    });

    res.json({
      kelas: {
        id: kelas.id,
        namaKelas: kelas.namaKelas,
        mataKuliah: kelas.mataKuliah.nama,
        kode: kelas.mataKuliah.kode
      },
      komponen,
      students: formattedStudents
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil rekap nilai kelas.', error: error.message });
  }
});

// POST bulk input nilai UTS/UAS
router.post('/nilai/bulk', async (req, res) => {
  try {
    const { updates } = req.body; // updates: [{mahasiswaId, komponenId, nilai}]
    if (!Array.isArray(updates)) return res.status(400).json({ message: 'Format data tidak valid.' });

    for (const update of updates) {
      const mId = parseInt(update.mahasiswaId);
      const kId = parseInt(update.komponenId);

      if (update.nilai === null || update.nilai === undefined || update.nilai === '') {
        await prisma.nilai.deleteMany({
          where: { mahasiswaId: mId, komponenId: kId, sesiId: null }
        });
        continue;
      }
      
      const val = parseFloat(update.nilai);
      
      const existing = await prisma.nilai.findFirst({
        where: {
          mahasiswaId: mId,
          komponenId: kId,
          sesiId: null
        }
      });

      if (existing) {
        await prisma.nilai.update({
          where: { id: existing.id },
          data: { nilai: val, diinputOleh: req.user.id }
        });
      } else {
        await prisma.nilai.create({
          data: {
            mahasiswaId: mId,
            komponenId: kId,
            sesiId: null,
            nilai: val,
            diinputOleh: req.user.id
          }
        });
      }
    }

    res.json({ message: 'Perubahan nilai berhasil disimpan.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menyimpan nilai.', error: error.message });
  }
});

// POST upload materi
router.post('/materi', upload.single('file'), async (req, res) => {
  try {
    const { mataKuliahId, judul, deskripsi, tipe, semester } = req.body;
    if (!req.file) return res.status(400).json({ message: 'File wajib diupload.' });

    const dosen = await prisma.dosen.findUnique({ where: { userId: req.user.id } });
    if (!dosen) return res.status(404).json({ message: 'Data dosen tidak ditemukan.' });

    const materi = await prisma.materi.create({
      data: {
        mataKuliahId: parseInt(mataKuliahId),
        dosenId: dosen.id,
        judul, deskripsi,
        tipe: tipe || 'materi',
        filePath: `/uploads/materi/${req.file.filename}`,
        ukuranKb: Math.round(req.file.size / 1024),
        semester,
        publishedAt: new Date(),
      },
    });
    res.status(201).json({ message: 'Materi berhasil diupload.', data: materi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengupload materi.', error: error.message });
  }
});

// GET semua materi per mata kuliah
router.get('/materi/:mataKuliahId', async (req, res) => {
  try {
    const materi = await prisma.materi.findMany({
      where: { mataKuliahId: parseInt(req.params.mataKuliahId) },
      orderBy: { createdAt: 'desc' },
    });
    res.json(materi);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil materi.' });
  }
});

// DELETE materi
router.delete('/materi/:id', async (req, res) => {
  try {
    const materiId = parseInt(req.params.id);
    const dosen = await prisma.dosen.findUnique({ where: { userId: req.user.id } });
    if (!dosen) return res.status(404).json({ message: 'Data dosen tidak ditemukan.' });

    const materi = await prisma.materi.findFirst({
      where: { id: materiId, dosenId: dosen.id },
    });

    if (!materi) {
      return res.status(404).json({ message: 'Materi tidak ditemukan atau Anda tidak berwenang menghapusnya.' });
    }

    // Hapus file fisik jika ada
    const filePath = path.join(__dirname, '../..', materi.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Hapus data dari DB
    await prisma.materi.delete({ where: { id: materiId } });

    res.json({ message: 'Materi berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus materi.', error: error.message });
  }
});


// GET semua ajuan yang dikirim dosen ini
router.get('/ajuan', async (req, res) => {
  try {
    const ajuan = await prisma.ajuanPindahJadwal.findMany({
      where: { pengajuId: req.user.id },
      include: {
        jadwalAsal: { include: { mataKuliah: true } },
        jadwalTujuan: { include: { mataKuliah: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ajuan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data ajuan.', error: error.message });
  }
});

// GET semua jadwal diampu dosen ini (untuk opsi jadwal asal)
router.get('/jadwal', async (req, res) => {
  try {
    const dosen = await prisma.dosen.findUnique({ where: { userId: req.user.id } });
    if (!dosen) return res.status(404).json({ message: 'Data dosen tidak ditemukan.' });

    const pengampu = await prisma.pengampu.findMany({
      where: { dosenId: dosen.id },
      select: { mataKuliahId: true },
    });

    const matkulIds = pengampu.map(p => p.mataKuliahId);

    const jadwal = await prisma.jadwalPraktikum.findMany({
      where: { mataKuliahId: { in: matkulIds } },
      include: {
        mataKuliah: true,
        ruangan: true,
      },
    });
    res.json(jadwal);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal dosen.' });
  }
});

// GET semua jadwal praktikum di sistem (untuk opsi pindah jadwal)
router.get('/semua-jadwal', async (req, res) => {
  try {
    const jadwal = await prisma.jadwalPraktikum.findMany({
      include: {
        mataKuliah: { select: { nama: true, kode: true } },
        ruangan: true,
      },
    });
    res.json(jadwal);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil seluruh jadwal.' });
  }
});

// POST ajuan perpindahan jadwal
router.post('/ajuan', async (req, res) => {
  try {
    const { jadwalAsalId, jadwalTujuanId, alasan } = req.body;
    const ajuan = await prisma.ajuanPindahJadwal.create({
      data: {
        pengajuId: req.user.id,
        jadwalAsalId: parseInt(jadwalAsalId),
        jadwalTujuanId: parseInt(jadwalTujuanId),
        alasan,
      },
    });
    res.status(201).json({ message: 'Ajuan berhasil dikirim.', data: ajuan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat ajuan.', error: error.message });
  }
});

module.exports = router;
