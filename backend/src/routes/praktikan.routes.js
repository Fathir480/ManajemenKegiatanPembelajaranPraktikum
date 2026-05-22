const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, authorize('praktikan'));

// GET profil mahasiswa + QR token
router.get('/profil', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { nama: true, email: true, fotoProfil: true } },
      },
    });
    if (!mahasiswa) return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });
    res.json(mahasiswa);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil profil.' });
  }
});

// GET jadwal praktikum mahasiswa
router.get('/jadwal', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({ where: { userId: req.user.id } });
    if (!mahasiswa) return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });

    const peserta = await prisma.pesertaJadwal.findMany({
      where: { mahasiswaId: mahasiswa.id },
      include: {
        jadwal: {
          include: {
            mataKuliah: { select: { nama: true, kode: true } },
            asisten: { include: { user: { select: { nama: true } } } },
            ruangan: true,
          },
        },
      },
    });
    res.json(peserta.map(p => p.jadwal));
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal.' });
  }
});

// GET rekap absensi mahasiswa
router.get('/absensi', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({ where: { userId: req.user.id } });
    if (!mahasiswa) return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });

    const absensi = await prisma.absensi.findMany({
      where: { mahasiswaId: mahasiswa.id },
      include: {
        sesi: {
          include: {
            jadwal: { include: { mataKuliah: { select: { nama: true } } } },
          },
        },
      },
      orderBy: { sesi: { tanggal: 'desc' } },
    });

    // Hitung rekapitulasi
    const rekap = absensi.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, { hadir: 0, izin: 0, sakit: 0, alpa: 0 });

    res.json({ detail: absensi, rekap });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil rekap absensi.' });
  }
});

// GET nilai mahasiswa
router.get('/nilai', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({ where: { userId: req.user.id } });
    if (!mahasiswa) return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });

    const nilai = await prisma.nilai.findMany({
      where: { mahasiswaId: mahasiswa.id },
      include: {
        komponen: {
          include: { mataKuliah: { select: { nama: true, kode: true } } },
        },
      },
      orderBy: { diinputPada: 'desc' },
    });

    const rekapAkhir = await prisma.rekapNilaiAkhir.findMany({
      where: { mahasiswaId: mahasiswa.id },
      include: { mataKuliah: { select: { nama: true, kode: true } } },
    });

    res.json({ nilaiDetail: nilai, rekapAkhir });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil nilai.' });
  }
});

module.exports = router;
