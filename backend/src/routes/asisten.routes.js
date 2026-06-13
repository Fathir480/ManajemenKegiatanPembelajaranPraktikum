const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, authorize('asisten'));

// GET jadwal yang diampu asisten ini
router.get('/jadwal', async (req, res) => {
  try {
    const asisten = await prisma.asisten.findUnique({ where: { userId: req.user.id } });
    if (!asisten) return res.status(404).json({ message: 'Data asisten tidak ditemukan.' });

    const jadwal = await prisma.jadwalPraktikum.findMany({
      where: { asisenId: asisten.id },
      include: {
        mataKuliah: true,
        ruangan: true,
        pesertaJadwal: { include: { mahasiswa: { include: { user: { select: { nama: true } } } } } },
      },
    });
    res.json(jadwal);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal.' });
  }
});

// GET semua sesi praktikum yang berkaitan dengan jadwal asisten ini
router.get('/sesi', async (req, res) => {
  try {
    const asisten = await prisma.asisten.findUnique({ where: { userId: req.user.id } });
    if (!asisten) return res.status(404).json({ message: 'Data asisten tidak ditemukan.' });

    const sesi = await prisma.sesiPraktikum.findMany({
      where: {
        jadwal: { asisenId: asisten.id }
      },
      include: {
        jadwal: {
          include: {
            mataKuliah: true,
            ruangan: true,
          },
        },
      },
      orderBy: [
        { pertemuanKe: 'asc' },
        { tanggal: 'asc' }
      ],
    });
    res.json(sesi);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil sesi praktikum.', error: error.message });
  }
});

// PUT buka sesi praktikum yang sudah ada (tergenerasi)
router.put('/sesi/:id/buka', async (req, res) => {
  try {
    const sesi = await prisma.sesiPraktikum.update({
      where: { id: parseInt(req.params.id) },
      data: {
        dibukaoOleh: req.user.id,
        dibukaPada: new Date(),
        ditutupPada: null, // Reset closed timestamp
        topik: req.body.topik || undefined
      },
    });
    res.json({ message: 'Sesi praktikum berhasil dibuka.', data: sesi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuka sesi.', error: error.message });
  }
});

// POST buka sesi praktikum baru (fallback/manual)
router.post('/sesi', async (req, res) => {
  try {
    const { jadwalId, tanggal, pertemuanKe, topik } = req.body;
    const sesi = await prisma.sesiPraktikum.create({
      data: {
        jadwalId: parseInt(jadwalId),
        tanggal: new Date(tanggal),
        pertemuanKe: parseInt(pertemuanKe) || 1,
        topik,
        dibukaoOleh: req.user.id,
        dibukaPada: new Date(),
      },
    });
    res.status(201).json({ message: 'Sesi praktikum berhasil dibuka.', data: sesi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuka sesi.', error: error.message });
  }
});

// PUT tutup sesi
router.put('/sesi/:id/tutup', async (req, res) => {
  try {
    const sesi = await prisma.sesiPraktikum.update({
      where: { id: parseInt(req.params.id) },
      data: { ditutupPada: new Date() },
    });
    res.json({ message: 'Sesi berhasil ditutup.', data: sesi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menutup sesi.', error: error.message });
  }
});

// GET daftar peserta di suatu sesi beserta status absensinya
router.get('/sesi/:id/peserta', async (req, res) => {
  try {
    const sesiId = parseInt(req.params.id);
    const sesi = await prisma.sesiPraktikum.findUnique({
      where: { id: sesiId },
      include: {
        jadwal: {
          include: {
            kelasRef: {
              include: {
                pesertaKelas: {
                  include: {
                    mahasiswa: {
                      include: { user: { select: { nama: true, email: true } } },
                    },
                  },
                },
              },
            },
            pesertaJadwal: {
              include: {
                mahasiswa: {
                  include: { user: { select: { nama: true, email: true } } },
                },
              },
            },
          },
        },
        absensi: true,
      },
    });
    if (!sesi) return res.status(404).json({ message: 'Sesi tidak ditemukan.' });

    let rawPeserta = [];
    if (sesi.jadwal.kelasId && sesi.jadwal.kelasRef) {
      rawPeserta = sesi.jadwal.kelasRef.pesertaKelas.map(pk => pk.mahasiswa);
    } else {
      rawPeserta = sesi.jadwal.pesertaJadwal.map(pj => pj.mahasiswa);
    }

    // Gabungkan daftar peserta dengan status absensi
    const peserta = rawPeserta.map(m => {
      const absensiRecord = sesi.absensi.find(a => a.mahasiswaId === m.id);
      return {
        mahasiswaId: m.id,
        stambuk: m.stambuk,
        qrToken: m.qrToken,
        nama: m.user.nama,
        email: m.user.email,
        absensi: absensiRecord || null,
      };
    });

    res.json({ sesi, peserta });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil peserta sesi.', error: error.message });
  }
});

// POST input absensi manual
router.post('/absensi/manual', async (req, res) => {
  try {
    const { sesiId, mahasiswaId, status, keterangan } = req.body;
    const absensi = await prisma.absensi.upsert({
      where: { sesiId_mahasiswaId: { sesiId: parseInt(sesiId), mahasiswaId: parseInt(mahasiswaId) } },
      update: { status, keterangan, metode: 'manual', dicatatOleh: req.user.id, waktuAbsen: new Date() },
      create: {
        sesiId: parseInt(sesiId),
        mahasiswaId: parseInt(mahasiswaId),
        status, keterangan,
        metode: 'manual',
        dicatatOleh: req.user.id,
        waktuAbsen: new Date(),
      },
    });
    res.json({ message: 'Absensi berhasil dicatat.', data: absensi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mencatat absensi.', error: error.message });
  }
});

// POST scan QR (mahasiswa scan QR mereka ke kamera asisten)
router.post('/absensi/qr', async (req, res) => {
  try {
    const { sesiId, qrToken } = req.body;

    // Cari mahasiswa berdasarkan QR token statis
    const mahasiswa = await prisma.mahasiswa.findUnique({ where: { qrToken } });
    if (!mahasiswa) return res.status(404).json({ message: 'QR Code tidak dikenali.' });

    // Pastikan mahasiswa terdaftar di jadwal sesi ini
    const sesi = await prisma.sesiPraktikum.findUnique({
      where: { id: parseInt(sesiId) },
      include: { jadwal: true }
    });
    if (!sesi) return res.status(404).json({ message: 'Sesi tidak ditemukan.' });

    let isRegistered = false;

    if (sesi.jadwal.kelasId) {
      // Cek apakah mahasiswa terdaftar di kelas tersebut
      const enrolled = await prisma.pesertaKelas.findUnique({
        where: {
          kelasId_mahasiswaId: {
            kelasId: sesi.jadwal.kelasId,
            mahasiswaId: mahasiswa.id
          }
        }
      });
      if (enrolled) {
        isRegistered = true;
      }
    } else {
      // Fallback ke check pesertaJadwal
      const peserta = await prisma.pesertaJadwal.findUnique({
        where: { jadwalId_mahasiswaId: { jadwalId: sesi.jadwalId, mahasiswaId: mahasiswa.id } },
      });
      if (peserta) {
        isRegistered = true;
      }
    }

    if (!isRegistered) {
      return res.status(403).json({ message: 'Mahasiswa tidak terdaftar di kelas ini.' });
    }

    // Cek apakah sudah absen
    const sudahAbsen = await prisma.absensi.findUnique({
      where: { sesiId_mahasiswaId: { sesiId: parseInt(sesiId), mahasiswaId: mahasiswa.id } },
    });
    if (sudahAbsen && sudahAbsen.status === 'hadir') {
      return res.status(400).json({ message: 'Mahasiswa sudah tercatat hadir.' });
    }

    const absensi = await prisma.absensi.upsert({
      where: { sesiId_mahasiswaId: { sesiId: parseInt(sesiId), mahasiswaId: mahasiswa.id } },
      update: { status: 'hadir', metode: 'qr_scan', waktuAbsen: new Date(), dicatatOleh: req.user.id },
      create: {
        sesiId: parseInt(sesiId),
        mahasiswaId: mahasiswa.id,
        status: 'hadir',
        metode: 'qr_scan',
        waktuAbsen: new Date(),
        dicatatOleh: req.user.id,
      },
    });

    const mhsUser = await prisma.user.findUnique({ where: { id: mahasiswa.userId }, select: { nama: true } });
    res.json({ message: `✅ ${mhsUser.nama} berhasil diabsen.`, data: absensi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memproses QR scan.', error: error.message });
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

// GET nilai mahasiswa di suatu jadwal per komponen
router.get('/jadwal/:jadwalId/nilai/:komponenId', async (req, res) => {
  try {
    const jadwalId = parseInt(req.params.jadwalId);
    const komponenId = parseInt(req.params.komponenId);
    
    // Cari jadwal
    const jadwal = await prisma.jadwalPraktikum.findUnique({
      where: { id: jadwalId },
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
      },
    });
    
    if (!jadwal) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
    
    let rawPeserta = [];
    if (jadwal.kelasId && jadwal.kelasRef) {
      rawPeserta = jadwal.kelasRef.pesertaKelas.map(pk => pk.mahasiswa);
    } else {
      rawPeserta = jadwal.pesertaJadwal.map(p => p.mahasiswa);
    }
    
    const peserta = rawPeserta.map(m => {
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
    
    res.json(peserta);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil nilai peserta.', error: error.message });
  }
});

// POST input nilai
router.post('/nilai', async (req, res) => {
  try {
    const { mahasiswaId, komponenId, sesiId, nilai, catatan } = req.body;
    const nilaiRecord = await prisma.nilai.upsert({
      where: { mahasiswaId_komponenId_sesiId: {
        mahasiswaId: parseInt(mahasiswaId),
        komponenId: parseInt(komponenId),
        sesiId: sesiId ? parseInt(sesiId) : null,
      }},
      update: { nilai: parseFloat(nilai), catatan, diinputOleh: req.user.id },
      create: {
        mahasiswaId: parseInt(mahasiswaId),
        komponenId: parseInt(komponenId),
        sesiId: sesiId ? parseInt(sesiId) : null,
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

// GET semua ajuan yang dikirim asisten ini
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

// GET semua materi untuk asisten (dari matkul yang diampu/asisteni)
router.get('/materi', async (req, res) => {
  try {
    const asisten = await prisma.asisten.findUnique({
      where: { userId: req.user.id },
    });
    if (!asisten) {
      return res.status(404).json({ message: 'Data asisten tidak ditemukan.' });
    }

    // Cari seluruh jadwal praktikum yang diampu/asisteni oleh asisten ini
    const jadwalPraktikum = await prisma.jadwalPraktikum.findMany({
      where: { asisenId: asisten.id },
      select: { mataKuliahId: true },
    });

    const matkulIds = [...new Set(jadwalPraktikum.map(j => j.mataKuliahId))];

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

// GET kelas yang dibimbing oleh asisten
router.get('/kelas', async (req, res) => {
  try {
    const asisten = await prisma.asisten.findUnique({ where: { userId: req.user.id } });
    if (!asisten) return res.status(404).json({ message: 'Data asisten tidak ditemukan.' });

    // Dapatkan semua kelas yang diajar oleh asisten ini berdasarkan JadwalPraktikum
    const jadwals = await prisma.jadwalPraktikum.findMany({
      where: { asisenId: asisten.id },
      include: {
        kelasRef: {
          include: {
            mataKuliah: true
          }
        }
      }
    });

    // Extract unique Kelas objects
    const kelasList = jadwals.filter(j => j.kelasRef).map(j => j.kelasRef);
    const uniqueKelas = Array.from(new Map(kelasList.map(item => [item.id, item])).values());

    res.json(uniqueKelas);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil kelas asisten.', error: error.message });
  }
});

// GET nilai matriks kelas (seperti admin/dosen)
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

// POST bulk input nilai praktikum/asistensi
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


// GET detail absensi kelas asisten (list mahasiswa & sesi & status absensi)
router.get('/absensi/kelas/:kelasId', async (req, res) => {
  try {
    const kelasId = parseInt(req.params.kelasId);
    
    // Cari asisten
    const asisten = await prisma.asisten.findUnique({ where: { userId: req.user.id } });
    if (!asisten) return res.status(404).json({ message: 'Data asisten tidak ditemukan.' });

    // Validasi penugasan asisten ke kelas ini
    const isAssigned = await prisma.jadwalPraktikum.findFirst({
      where: {
        asisenId: asisten.id,
        kelasId: kelasId
      }
    });
    if (!isAssigned) {
      return res.status(403).json({ message: 'Anda tidak berwenang mengakses data absensi kelas ini.' });
    }

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
      sessions: sesi.map(s => ({
        id: s.id,
        tanggal: s.tanggal,
        pertemuanKe: s.pertemuanKe,
        topik: s.topik,
        dibukaPada: s.dibukaPada,
        ditutupPada: s.ditutupPada
      })),
      attendance: absensi
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data absensi kelas.', error: error.message });
  }
});

// PUT ubah tanggal sesi absensi asisten
router.put('/absensi/sesi/:sesiId', async (req, res) => {
  try {
    const sesiId = parseInt(req.params.sesiId);
    const { tanggal } = req.body;
    if (!tanggal) {
      return res.status(400).json({ message: 'Tanggal wajib diisi.' });
    }

    const start = new Date(tanggal);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ message: 'Format tanggal tidak valid.' });
    }

    // Cari asisten
    const asisten = await prisma.asisten.findUnique({ where: { userId: req.user.id } });
    if (!asisten) return res.status(404).json({ message: 'Data asisten tidak ditemukan.' });

    // Cari sesi dan validasi penugasan asisten
    const sesiRecord = await prisma.sesiPraktikum.findUnique({
      where: { id: sesiId },
      include: { jadwal: true }
    });
    if (!sesiRecord) {
      return res.status(404).json({ message: 'Sesi praktikum tidak ditemukan.' });
    }
    if (sesiRecord.jadwal.asisenId !== asisten.id) {
      return res.status(403).json({ message: 'Anda tidak berwenang mengubah sesi untuk jadwal ini.' });
    }

    const updatedSesi = await prisma.sesiPraktikum.update({
      where: { id: sesiId },
      data: { tanggal: start }
    });

    res.json({ message: 'Tanggal absensi berhasil diubah.', updatedSesi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengubah tanggal absensi.', error: error.message });
  }
});

// PUT perbarui status absensi mahasiswa manual oleh asisten
router.put('/absensi/update', async (req, res) => {
  try {
    const { sesiId, mahasiswaId, status } = req.body;
    if (!sesiId || !mahasiswaId || !status) {
      return res.status(400).json({ message: 'Sesi, mahasiswa, dan status wajib diisi.' });
    }

    const validStatuses = ['hadir', 'izin', 'sakit', 'alpa'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Status absensi tidak valid.' });
    }

    // Cari asisten
    const asisten = await prisma.asisten.findUnique({ where: { userId: req.user.id } });
    if (!asisten) return res.status(404).json({ message: 'Data asisten tidak ditemukan.' });

    // Cari sesi dan validasi penugasan asisten
    const sesiRecord = await prisma.sesiPraktikum.findUnique({
      where: { id: parseInt(sesiId) },
      include: { jadwal: true }
    });
    if (!sesiRecord) {
      return res.status(404).json({ message: 'Sesi praktikum tidak ditemukan.' });
    }
    if (sesiRecord.jadwal.asisenId !== asisten.id) {
      return res.status(403).json({ message: 'Anda tidak berwenang memperbarui absensi untuk jadwal ini.' });
    }

    const absensi = await prisma.absensi.upsert({
      where: {
        sesiId_mahasiswaId: {
          sesiId: parseInt(sesiId),
          mahasiswaId: parseInt(mahasiswaId)
        }
      },
      update: { status, dicatatOleh: req.user.id, waktuAbsen: new Date() },
      create: {
        sesiId: parseInt(sesiId),
        mahasiswaId: parseInt(mahasiswaId),
        status,
        metode: 'manual',
        dicatatOleh: req.user.id,
        waktuAbsen: new Date()
      }
    });

    res.json({ message: 'Absensi berhasil diperbarui.', absensi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui absensi.', error: error.message });
  }
});

module.exports = router;

