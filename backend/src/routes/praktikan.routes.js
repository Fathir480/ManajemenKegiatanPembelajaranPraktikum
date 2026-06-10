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

// GET semua materi untuk mahasiswa (dari matkul yang diikuti)
router.get('/materi', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id },
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });
    }

    // Cari seluruh jadwal praktikum yang diikuti mahasiswa ini
    const pesertaJadwal = await prisma.pesertaJadwal.findMany({
      where: { mahasiswaId: mahasiswa.id },
      select: {
        jadwal: {
          select: { mataKuliahId: true },
        },
      },
    });

    const matkulIds = [...new Set(pesertaJadwal.map(pj => pj.jadwal.mataKuliahId))];

    // Cari materi untuk mata kuliah tersebut
    const materi = await prisma.materi.findMany({
      where: {
        mataKuliahId: { in: matkulIds },
      },
      include: {
        mataKuliah: {
          select: { kode: true, nama: true },
        },
        dosen: {
          include: {
            user: {
              select: { nama: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(materi);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil materi praktikum.', error: error.message });
  }
});

// GET daftar kelas (krs) untuk mahasiswa
router.get('/kelas', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id }
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });
    }

    const classes = await prisma.kelas.findMany({
      where: { aktif: true },
      include: {
        mataKuliah: {
          select: { id: true, kode: true, nama: true, sks: true }
        },
        dosen: {
          include: {
            user: {
              select: { nama: true }
            }
          }
        },
        pesertaKelas: {
          where: { mahasiswaId: mahasiswa.id }
        },
        _count: {
          select: { pesertaKelas: true }
        }
      }
    });

    const formattedClasses = classes.map(c => ({
      id: c.id,
      namaKelas: c.namaKelas,
      mataKuliah: c.mataKuliah,
      dosen: c.dosen?.user?.nama || '-',
      isEnrolled: c.pesertaKelas.length > 0,
      studentCount: c._count.pesertaKelas
    }));

    res.json(formattedClasses);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data kelas.', error: error.message });
  }
});

// POST enroll ke kelas
router.post('/kelas/enroll', async (req, res) => {
  try {
    const { kelasId } = req.body;
    if (!kelasId) {
      return res.status(400).json({ message: 'kelasId diperlukan.' });
    }

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id }
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });
    }

    // Cek kelas aktif
    const targetKelas = await prisma.kelas.findFirst({
      where: { id: parseInt(kelasId), aktif: true }
    });
    if (!targetKelas) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan atau tidak aktif.' });
    }

    // Cek apakah mahasiswa sudah terdaftar di kelas lain dengan mataKuliahId yang sama
    const existingSameCourse = await prisma.pesertaKelas.findFirst({
      where: {
        mahasiswaId: mahasiswa.id,
        kelas: {
          mataKuliahId: targetKelas.mataKuliahId
        }
      },
      include: {
        kelas: true
      }
    });

    if (existingSameCourse) {
      return res.status(400).json({ 
        message: `Anda sudah terdaftar di kelas '${existingSameCourse.kelas.namaKelas}' untuk mata kuliah yang sama.` 
      });
    }

    // Cek apakah sudah terdaftar (fallback)
    const existing = await prisma.pesertaKelas.findUnique({
      where: {
        kelasId_mahasiswaId: {
          kelasId: parseInt(kelasId),
          mahasiswaId: mahasiswa.id
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Anda sudah terdaftar di kelas ini.' });
    }

    // Daftar kelas
    await prisma.pesertaKelas.create({
      data: {
        kelasId: parseInt(kelasId),
        mahasiswaId: mahasiswa.id
      }
    });

    res.status(201).json({ message: 'Berhasil mendaftar ke kelas.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mendaftar ke kelas.', error: error.message });
  }
});


// POST drop dari kelas
router.post('/kelas/drop', async (req, res) => {
  try {
    const { kelasId } = req.body;
    if (!kelasId) {
      return res.status(400).json({ message: 'kelasId diperlukan.' });
    }

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id }
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });
    }

    // Cari pendaftaran
    const existing = await prisma.pesertaKelas.findUnique({
      where: {
        kelasId_mahasiswaId: {
          kelasId: parseInt(kelasId),
          mahasiswaId: mahasiswa.id
        }
      }
    });

    if (!existing) {
      return res.status(400).json({ message: 'Anda tidak terdaftar di kelas ini.' });
    }

    // Hapus pendaftaran
    await prisma.pesertaKelas.delete({
      where: {
        kelasId_mahasiswaId: {
          kelasId: parseInt(kelasId),
          mahasiswaId: mahasiswa.id
        }
      }
    });

    res.json({ message: 'Berhasil keluar dari kelas.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal keluar dari kelas.', error: error.message });
  }
});

module.exports = router;

