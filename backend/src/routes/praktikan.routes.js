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

    // 1. Get schedules where student is enrolled in the Class (pesertaKelas -> kelas -> jadwalPraktikum)
    const classSchedules = await prisma.jadwalPraktikum.findMany({
      where: {
        kelasRef: {
          pesertaKelas: {
            some: { mahasiswaId: mahasiswa.id }
          }
        }
      },
      include: {
        mataKuliah: { select: { nama: true, kode: true } },
        asisten: { include: { user: { select: { nama: true } } } },
        ruangan: true,
      }
    });

    // 2. Get schedules where student is directly registered (pesertaJadwal - fallback)
    const directSchedules = await prisma.pesertaJadwal.findMany({
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
    }).then(res => res.map(r => r.jadwal));

    // Combine both lists and filter duplicates by schedule ID
    const allSchedules = [...classSchedules, ...directSchedules];
    const uniqueSchedules = Array.from(new Map(allSchedules.map(j => [j.id, j])).values());

    res.json(uniqueSchedules);
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

// GET matriks absensi kelas (read-only for student)
router.get('/absensi/kelas/:kelasId', async (req, res) => {
  try {
    const kelasId = parseInt(req.params.kelasId);
    
    // Pastikan mahasiswa
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id }
    });
    if (!mahasiswa) return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });

    // Cek apakah mahasiswa terdaftar di kelas ini
    const isEnrolled = await prisma.pesertaKelas.findUnique({
      where: { kelasId_mahasiswaId: { kelasId, mahasiswaId: mahasiswa.id } }
    });
    if (!isEnrolled) return res.status(403).json({ message: 'Anda tidak memiliki akses ke absensi kelas ini.' });

    // Ambil detail kelas
    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      include: { mataKuliah: true }
    });

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

    // Ambil semua sesi praktikum kelas ini
    const sesi = await prisma.sesiPraktikum.findMany({
      where: { jadwal: { kelasId } },
      orderBy: [ { pertemuanKe: 'asc' }, { tanggal: 'asc' } ]
    });

    const sesiIds = sesi.map(s => s.id);

    // Ambil data absensi
    let absensi = [];
    if (sesiIds.length > 0) {
      absensi = await prisma.absensi.findMany({
        where: { sesiId: { in: sesiIds } }
      });
    }

    const formattedStudents = peserta.map(p => ({
      id: p.mahasiswa.id,
      nama: p.mahasiswa.user.nama,
      stambuk: p.mahasiswa.stambuk
    }));

    res.json({
      kelas,
      students: formattedStudents,
      sessions: sesi,
      attendance: absensi
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil matriks absensi kelas.' });
  }
});

// GET kelas yang di-enroll mahasiswa
router.get('/enrolled-classes', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id },
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });
    }

    const enrolledClasses = await prisma.pesertaKelas.findMany({
      where: { mahasiswaId: mahasiswa.id },
      include: {
        kelas: {
          include: { mataKuliah: true }
        }
      }
    });
    
    const classes = enrolledClasses.map(pk => pk.kelas);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil kelas yang diikuti.' });
  }
});

// GET semua nilai mahasiswa (OLD - kept for backwards compatibility if needed elsewhere)
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

// GET matriks nilai mahasiswa untuk satu kelas
router.get('/nilai/kelas/:kelasId', async (req, res) => {
  try {
    const kelasId = parseInt(req.params.kelasId);
    
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { nama: true } } }
    });
    if (!mahasiswa) return res.status(404).json({ message: 'Mahasiswa tidak ditemukan.' });

    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      include: { mataKuliah: true }
    });
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });

    // Ambil komponen nilai
    let komponen = await prisma.komponenNilai.findMany({
      where: { mataKuliahId: kelas.mataKuliahId },
      orderBy: { id: 'asc' }
    });

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
          include: { user: { select: { nama: true } } }
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
      kelas,
      komponen,
      students: formattedStudents
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data nilai kelas.' });
  }
});

// GET semua materi untuk mahasiswa (dari kelas yang diikuti)
router.get('/materi', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id },
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });
    }

    // Ambil semua kelas yang di-enroll oleh praktikan ini
    const enrolledClasses = await prisma.pesertaKelas.findMany({
      where: { mahasiswaId: mahasiswa.id },
      select: { kelasId: true }
    });
    const kelasIds = enrolledClasses.map(pk => pk.kelasId);

    // Cari materi khusus untuk kelas-kelas tersebut
    const materi = await prisma.materi.findMany({
      where: {
        kelasId: { in: kelasIds },
      },
      include: {
        kelas: {
          include: {
            mataKuliah: { select: { kode: true, nama: true } }
          }
        },
        dosen: {
          include: {
            user: { select: { nama: true } },
          },
        },
        uploader: {
          select: { nama: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(materi);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil materi praktikum.', error: error.message });
  }
});

// GET jadwal praktikum mahasiswa (berdasarkan kelas yang di-enroll)
router.get('/jadwal', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: req.user.id }
    });
    if (!mahasiswa) {
      return res.status(404).json({ message: 'Data mahasiswa tidak ditemukan.' });
    }

    // Ambil kelas yang di-enroll
    const enrolledClasses = await prisma.pesertaKelas.findMany({
      where: { mahasiswaId: mahasiswa.id },
      select: { kelasId: true }
    });
    const kelasIds = enrolledClasses.map(pk => pk.kelasId);

    const jadwal = await prisma.jadwalPraktikum.findMany({
      where: {
        kelasId: { in: kelasIds }
      },
      include: {
        mataKuliah: true,
        ruangan: true,
        asisten: {
          include: { user: { select: { nama: true } } }
        },
        dosen: {
          include: { user: { select: { nama: true } } }
        },
        kelas: true
      },
      orderBy: { id: 'asc' }
    });

    res.json(jadwal);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal praktikum.', error: error.message });
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

