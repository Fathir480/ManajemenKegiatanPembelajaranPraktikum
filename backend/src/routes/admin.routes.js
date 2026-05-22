const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, authorize('admin'));

// ── MAHASISWA ──────────────────────────────────────────────

// GET semua mahasiswa
router.get('/mahasiswa', async (req, res) => {
  try {
    const mahasiswa = await prisma.mahasiswa.findMany({
      include: { user: { select: { nama: true, email: true, aktif: true } } },
      orderBy: { stambuk: 'asc' },
    });
    res.json(mahasiswa);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data mahasiswa.', error: error.message });
  }
});

// POST tambah mahasiswa (sekaligus buat user)
router.post('/mahasiswa', async (req, res) => {
  try {
    const { nama, email, password, stambuk, angkatan, programStudi } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'Email sudah terdaftar.' });

    const existingMhs = await prisma.mahasiswa.findUnique({ where: { stambuk } });
    if (existingMhs) return res.status(400).json({ message: 'Stambuk sudah terdaftar.' });

    const roleId = await prisma.role.findUnique({ where: { namaRole: 'praktikan' } });
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        nama, email, passwordHash,
        roleId: roleId.id,
        mahasiswa: {
          create: { stambuk, angkatan: parseInt(angkatan), programStudi },
        },
      },
      include: { mahasiswa: true },
    });

    const { passwordHash: _, ...userSafe } = user;
    res.status(201).json({ message: 'Mahasiswa berhasil ditambahkan.', data: userSafe });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah mahasiswa.', error: error.message });
  }
});

// PUT update stambuk mahasiswa
router.put('/mahasiswa/:id', async (req, res) => {
  try {
    const { stambuk, angkatan, programStudi, nama, aktif } = req.body;
    const mhs = await prisma.mahasiswa.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true },
    });
    if (!mhs) return res.status(404).json({ message: 'Mahasiswa tidak ditemukan.' });

    await prisma.mahasiswa.update({
      where: { id: mhs.id },
      data: { stambuk, angkatan: angkatan ? parseInt(angkatan) : undefined, programStudi },
    });
    if (nama || aktif !== undefined) {
      await prisma.user.update({
        where: { id: mhs.userId },
        data: { nama, aktif },
      });
    }
    res.json({ message: 'Data mahasiswa berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui mahasiswa.', error: error.message });
  }
});

// DELETE mahasiswa
router.delete('/mahasiswa/:id', async (req, res) => {
  try {
    const mhs = await prisma.mahasiswa.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!mhs) return res.status(404).json({ message: 'Mahasiswa tidak ditemukan.' });
    await prisma.user.delete({ where: { id: mhs.userId } }); // cascade akan hapus mahasiswa
    res.json({ message: 'Mahasiswa berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus mahasiswa.', error: error.message });
  }
});

// ── DOSEN ──────────────────────────────────────────────────

router.get('/dosen', async (req, res) => {
  try {
    const dosen = await prisma.dosen.findMany({
      include: { user: { select: { nama: true, email: true, aktif: true } } },
    });
    res.json(dosen);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data dosen.' });
  }
});

router.post('/dosen', async (req, res) => {
  try {
    const { nama, email, password, nid, spesialisasi } = req.body;
    const roleId = await prisma.role.findUnique({ where: { namaRole: 'dosen' } });
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        nama, email, passwordHash,
        roleId: roleId.id,
        dosen: { create: { nid, spesialisasi } },
      },
      include: { dosen: true },
    });
    const { passwordHash: _, ...userSafe } = user;
    res.status(201).json({ message: 'Dosen berhasil ditambahkan.', data: userSafe });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah dosen.', error: error.message });
  }
});

// ── MATA KULIAH ────────────────────────────────────────────

router.get('/matkul', async (req, res) => {
  try {
    const matkul = await prisma.mataKuliah.findMany({ orderBy: { kode: 'asc' } });
    res.json(matkul);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil mata kuliah.' });
  }
});

router.post('/matkul', async (req, res) => {
  try {
    const { kode, nama, sks, tipe, deskripsi } = req.body;
    const matkul = await prisma.mataKuliah.create({
      data: { kode, nama, sks: parseInt(sks), tipe, deskripsi },
    });
    res.status(201).json({ message: 'Mata kuliah berhasil ditambahkan.', data: matkul });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah mata kuliah.', error: error.message });
  }
});

router.put('/matkul/:id', async (req, res) => {
  try {
    const { nama, sks, tipe, deskripsi, aktif } = req.body;
    const matkul = await prisma.mataKuliah.update({
      where: { id: parseInt(req.params.id) },
      data: { nama, sks: sks ? parseInt(sks) : undefined, tipe, deskripsi, aktif },
    });
    res.json({ message: 'Mata kuliah berhasil diperbarui.', data: matkul });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui mata kuliah.', error: error.message });
  }
});

// ── JADWAL PRAKTIKUM ───────────────────────────────────────

router.get('/jadwal', async (req, res) => {
  try {
    const jadwal = await prisma.jadwalPraktikum.findMany({
      include: {
        mataKuliah: { select: { nama: true, kode: true } },
        asisten: { include: { user: { select: { nama: true } } } },
        ruangan: true,
      },
      orderBy: [{ hari: 'asc' }, { jamMulai: 'asc' }],
    });
    res.json(jadwal);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal.' });
  }
});

router.post('/jadwal', async (req, res) => {
  try {
    const { mataKuliahId, asisenId, ruanganId, hari, jamMulai, jamSelesai, semester, kapasitasGrup } = req.body;
    const jadwal = await prisma.jadwalPraktikum.create({
      data: {
        mataKuliahId: parseInt(mataKuliahId),
        asisenId: asisenId ? parseInt(asisenId) : null,
        ruanganId: ruanganId ? parseInt(ruanganId) : null,
        hari, jamMulai, jamSelesai, semester,
        kapasitasGrup: parseInt(kapasitasGrup) || 30,
      },
    });
    res.status(201).json({ message: 'Jadwal berhasil ditambahkan.', data: jadwal });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah jadwal.', error: error.message });
  }
});

// ── VALIDASI AJUAN PINDAH JADWAL ───────────────────────────

router.get('/ajuan', async (req, res) => {
  try {
    const ajuan = await prisma.ajuanPindahJadwal.findMany({
      include: {
        pengaju: { select: { nama: true, role: true } },
        jadwalAsal: { include: { mataKuliah: true } },
        jadwalTujuan: { include: { mataKuliah: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ajuan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil ajuan.' });
  }
});

router.put('/ajuan/:id/validasi', async (req, res) => {
  try {
    const { status, catatanAdmin } = req.body; // 'disetujui' | 'ditolak'
    if (!['disetujui', 'ditolak'].includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid.' });
    }
    const ajuan = await prisma.ajuanPindahJadwal.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status,
        catatanAdmin,
        diprosesOleh: req.user.id,
        diprosesOn: new Date(),
      },
    });
    res.json({ message: `Ajuan berhasil ${status}.`, data: ajuan });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memvalidasi ajuan.', error: error.message });
  }
});

module.exports = router;
