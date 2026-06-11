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

// GET semua mahasiswa peserta mata kuliah beserta nilainya untuk komponen tertentu
router.get('/matkul/:mataKuliahId/nilai/:komponenId', async (req, res) => {
  try {
    const mataKuliahId = parseInt(req.params.mataKuliahId);
    const komponenId = parseInt(req.params.komponenId);

    // Cari seluruh jadwal praktikum untuk mata kuliah ini
    const jadwals = await prisma.jadwalPraktikum.findMany({
      where: { mataKuliahId },
      include: {
        kelasRef: {
          include: {
            pesertaKelas: {
              include: {
                mahasiswa: {
                  include: {
                    user: { select: { nama: true, email: true } },
                    nilai: {
                      where: { komponenId }
                    }
                  }
                }
              }
            }
          }
        },
        pesertaJadwal: {
          include: {
            mahasiswa: {
              include: {
                user: { select: { nama: true, email: true } },
                nilai: {
                  where: { komponenId },
                },
              },
            },
          },
        },
      }
    });

    let rawPeserta = [];
    for (const j of jadwals) {
      if (j.kelasId && j.kelasRef) {
        rawPeserta = rawPeserta.concat(j.kelasRef.pesertaKelas.map(pk => pk.mahasiswa));
      } else {
        rawPeserta = rawPeserta.concat(j.pesertaJadwal.map(pj => pj.mahasiswa));
      }
    }

    // Gabungkan data mahasiswa dengan nilai komponen
    const result = rawPeserta.map(m => {
      const nilaiRecord = m.nilai?.[0] || null;
      return {
        mahasiswaId: m.id,
        stambuk: m.stambuk,
        nama: m.user.nama,
        email: m.user.email,
        nilai: nilaiRecord ? nilaiRecord.nilai : 0,
        catatan: nilaiRecord ? nilaiRecord.catatan : '',
      };
    });

    // Remove duplicates
    const uniqueResult = Array.from(new Map(result.map(item => [item.mahasiswaId, item])).values());

    res.json(uniqueResult);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil nilai peserta.', error: error.message });
  }
});

// POST input nilai UTS/UAS
router.post('/nilai', async (req, res) => {
  try {
    const { mahasiswaId, komponenId, nilai, catatan } = req.body;
    const nilaiRecord = await prisma.nilai.upsert({
      where: { mahasiswaId_komponenId_sesiId: {
        mahasiswaId: parseInt(mahasiswaId),
        komponenId: parseInt(komponenId),
        sesiId: null,
      }},
      update: { nilai: parseFloat(nilai), catatan, diinputOleh: req.user.id },
      create: {
        mahasiswaId: parseInt(mahasiswaId),
        komponenId: parseInt(komponenId),
        sesiId: null,
        nilai: parseFloat(nilai),
        catatan,
        diinputOleh: req.user.id,
      },
    });
    res.json({ message: 'Nilai berhasil disimpan.', data: nilaiRecord });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menyimpan nilai.', error: error.message });
  }
});

// GET rekap nilai semua mahasiswa per mata kuliah
router.get('/rekap/:mataKuliahId', async (req, res) => {
  try {
    const rekap = await prisma.rekapNilaiAkhir.findMany({
      where: { mataKuliahId: parseInt(req.params.mataKuliahId) },
      include: {
        mahasiswa: { include: { user: { select: { nama: true } } } },
        mataKuliah: { select: { nama: true } },
      },
      orderBy: { mahasiswa: { stambuk: 'asc' } },
    });
    res.json(rekap);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil rekap nilai.' });
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
