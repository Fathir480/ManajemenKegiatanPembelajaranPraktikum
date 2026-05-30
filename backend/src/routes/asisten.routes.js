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

// GET semua sesi praktikum yang dibuka asisten ini
router.get('/sesi', async (req, res) => {
  try {
    const sesi = await prisma.sesiPraktikum.findMany({
      where: { dibukaoOleh: req.user.id },
      include: {
        jadwal: {
          include: {
            mataKuliah: true,
            ruangan: true,
          },
        },
      },
      orderBy: { tanggal: 'desc' },
    });
    res.json(sesi);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil sesi praktikum.', error: error.message });
  }
});

// POST buka sesi praktikum
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

    // Gabungkan daftar peserta dengan status absensi
    const peserta = sesi.jadwal.pesertaJadwal.map(p => {
      const absensiRecord = sesi.absensi.find(a => a.mahasiswaId === p.mahasiswaId);
      return {
        mahasiswaId: p.mahasiswaId,
        stambuk: p.mahasiswa.stambuk,
        qrToken: p.mahasiswa.qrToken,
        nama: p.mahasiswa.user.nama,
        email: p.mahasiswa.user.email,
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
    const sesi = await prisma.sesiPraktikum.findUnique({ where: { id: parseInt(sesiId) } });
    if (!sesi) return res.status(404).json({ message: 'Sesi tidak ditemukan.' });

    const peserta = await prisma.pesertaJadwal.findUnique({
      where: { jadwalId_mahasiswaId: { jadwalId: sesi.jadwalId, mahasiswaId: mahasiswa.id } },
    });
    if (!peserta) return res.status(403).json({ message: 'Mahasiswa tidak terdaftar di kelas ini.' });

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
    
    const peserta = jadwal.pesertaJadwal.map(p => {
      const nilaiRecord = p.mahasiswa.nilai[0] || null;
      return {
        mahasiswaId: p.mahasiswaId,
        stambuk: p.mahasiswa.stambuk,
        nama: p.mahasiswa.user.nama,
        email: p.mahasiswa.user.email,
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

module.exports = router;
