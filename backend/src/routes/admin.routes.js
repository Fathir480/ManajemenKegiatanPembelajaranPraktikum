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
      include: { 
        user: { 
          select: { 
            id: true,
            nama: true, 
            email: true, 
            aktif: true,
            roleId: true,
            role: true
          } 
        } 
      },
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

    const finalEmail = (email && email.trim()) ? email : `${stambuk.trim()}@student.umi.ac.id`;
    const finalPassword = (password && password.trim()) ? password : `mhs${angkatan}`;

    const existingUser = await prisma.user.findUnique({ where: { email: finalEmail } });
    if (existingUser) return res.status(400).json({ message: 'Email sudah terdaftar.' });

    const existingMhs = await prisma.mahasiswa.findUnique({ where: { stambuk } });
    if (existingMhs) return res.status(400).json({ message: 'Stambuk sudah terdaftar.' });

    // Hitung jumlah mahasiswa di angkatan & prodi yang sama untuk menentukan kelas otomatis (A1, A2, dst - maks 30 per kelas)
    const count = await prisma.mahasiswa.count({
      where: {
        angkatan: parseInt(angkatan),
        programStudi: programStudi || null
      }
    });
    const classNumber = Math.floor(count / 30) + 1;
    const kelas = `A${classNumber}`;

    const roleId = await prisma.role.findUnique({ where: { namaRole: 'praktikan' } });
    const passwordHash = await bcrypt.hash(finalPassword, 10);

    const user = await prisma.user.create({
      data: {
        nama,
        email: finalEmail,
        passwordHash,
        roleId: roleId.id,
        mahasiswa: {
          create: { stambuk, angkatan: parseInt(angkatan), programStudi, kelas },
        },
      },
      include: { mahasiswa: true },
    });

    const { passwordHash: _, ...userSafe } = user;
    res.status(201).json({ message: `Mahasiswa berhasil ditambahkan ke Kelas ${kelas}.`, data: userSafe });
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

    const finalEmail = `${stambuk.trim()}@student.umi.ac.id`;

    await prisma.mahasiswa.update({
      where: { id: mhs.id },
      data: { stambuk, angkatan: angkatan ? parseInt(angkatan) : undefined, programStudi },
    });
    
    await prisma.user.update({
      where: { id: mhs.userId },
      data: { 
        nama, 
        email: finalEmail,
        aktif: aktif !== undefined ? aktif : undefined 
      },
    });

    res.json({ message: 'Data mahasiswa berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui mahasiswa.', error: error.message });
  }
});

// DELETE mahasiswa
router.delete('/mahasiswa/:id', async (req, res) => {
  try {
    const mhsId = parseInt(req.params.id);
    const mhs = await prisma.mahasiswa.findUnique({ where: { id: mhsId } });
    if (!mhs) return res.status(404).json({ message: 'Mahasiswa tidak ditemukan.' });

    // Hapus semua relasi terkait terlebih dahulu dalam satu transaksi agar tidak terjadi bentrok foreign key
    await prisma.$transaction([
      prisma.nilai.deleteMany({ where: { mahasiswaId: mhsId } }),
      prisma.absensi.deleteMany({ where: { mahasiswaId: mhsId } }),
      prisma.pesertaJadwal.deleteMany({ where: { mahasiswaId: mhsId } }),
      prisma.rekapNilaiAkhir.deleteMany({ where: { mahasiswaId: mhsId } }),
      prisma.user.delete({ where: { id: mhs.userId } }) // cascade akan menghapus data di tabel mahasiswa
    ]);

    res.json({ message: 'Mahasiswa berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus mahasiswa.', error: error.message });
  }
});

// POST impor massal mahasiswa (Excel/CSV)
router.post('/mahasiswa/bulk', async (req, res) => {
  try {
    const { items } = req.body; // Array dari { nama, email, password, stambuk, angkatan, programStudi }
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Data items harus berupa array.' });

    const roleId = await prisma.role.findUnique({ where: { namaRole: 'praktikan' } });
    let successCount = 0;
    let skipCount = 0;

    for (const item of items) {
      try {
        const { nama, email, password, stambuk, angkatan, programStudi } = item;
        
        const finalEmail = (email && email.trim()) ? email : `${String(stambuk).trim()}@student.umi.ac.id`;
        const finalPassword = (password && password.trim()) ? password : `mhs${angkatan}`;

        if (!finalEmail || !stambuk || !nama || !angkatan) {
          skipCount++;
          continue;
        }

        const existingUser = await prisma.user.findUnique({ where: { email: finalEmail } });
        if (existingUser) { skipCount++; continue; }

        const existingMhs = await prisma.mahasiswa.findUnique({ where: { stambuk: String(stambuk) } });
        if (existingMhs) { skipCount++; continue; }

        // Hitung kelas otomatis (A1, A2, dst)
        const count = await prisma.mahasiswa.count({
          where: {
            angkatan: parseInt(angkatan),
            programStudi: programStudi || null
          }
        });
        const classNumber = Math.floor(count / 30) + 1;
        const kelas = `A${classNumber}`;

        const pHash = await bcrypt.hash(finalPassword, 10);

        await prisma.user.create({
          data: {
            nama, 
            email: finalEmail, 
            passwordHash: pHash,
            roleId: roleId.id,
            mahasiswa: {
              create: { stambuk: String(stambuk), angkatan: parseInt(angkatan), programStudi, kelas },
            },
          }
        });
        successCount++;
      } catch (err) {
        skipCount++;
      }
    }

    res.json({ message: `Impor massal selesai. ${successCount} mahasiswa berhasil ditambahkan, ${skipCount} dilewati.` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan impor massal mahasiswa.', error: error.message });
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
    const finalEmail = (email && email.trim()) ? email : `${nid.trim()}@lecturer.umi.ac.id`;
    const finalPassword = (password && password.trim()) ? password : '123';

    const existingUser = await prisma.user.findUnique({ where: { email: finalEmail } });
    if (existingUser) return res.status(400).json({ message: 'Email sudah terdaftar.' });

    const existingDosen = await prisma.dosen.findUnique({ where: { nid } });
    if (existingDosen) return res.status(400).json({ message: 'NID sudah terdaftar.' });

    const roleId = await prisma.role.findUnique({ where: { namaRole: 'dosen' } });
    const passwordHash = await bcrypt.hash(finalPassword, 10);

    const user = await prisma.user.create({
      data: {
        nama,
        email: finalEmail,
        passwordHash,
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

// PUT update dosen
router.put('/dosen/:id', async (req, res) => {
  try {
    const { nid, spesialisasi, nama, email, aktif } = req.body;
    const dosen = await prisma.dosen.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true },
    });
    if (!dosen) return res.status(404).json({ message: 'Dosen tidak ditemukan.' });

    const finalEmail = email || `${nid.trim()}@lecturer.umi.ac.id`;

    await prisma.dosen.update({
      where: { id: dosen.id },
      data: { nid, spesialisasi },
    });
    
    await prisma.user.update({
      where: { id: dosen.userId },
      data: { 
        nama, 
        email: finalEmail, 
        aktif: aktif !== undefined ? aktif : undefined 
      },
    });
    res.json({ message: 'Data dosen berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui dosen.', error: error.message });
  }
});

// DELETE dosen (cascade delete associated assignments/pengampu)
router.delete('/dosen/:id', async (req, res) => {
  try {
    const dosenId = parseInt(req.params.id);
    const dosen = await prisma.dosen.findUnique({ where: { id: dosenId } });
    if (!dosen) return res.status(404).json({ message: 'Dosen tidak ditemukan.' });

    await prisma.$transaction([
      prisma.pengampu.deleteMany({ where: { dosenId: dosenId } }),
      prisma.user.delete({ where: { id: dosen.userId } })
    ]);

    res.json({ message: 'Dosen berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus dosen.', error: error.message });
  }
});

// POST impor massal dosen (Excel/CSV)
router.post('/dosen/bulk', async (req, res) => {
  try {
    const { items } = req.body; // Array dari { nama, email, password, nid, spesialisasi }
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Data items harus berupa array.' });

    const roleId = await prisma.role.findUnique({ where: { namaRole: 'dosen' } });
    let successCount = 0;
    let skipCount = 0;

    for (const item of items) {
      try {
        const { nama, email, password, nid, spesialisasi } = item;
        const finalEmail = (email && email.trim()) ? email : `${String(nid).trim()}@lecturer.umi.ac.id`;
        const finalPassword = (password && password.trim()) ? password : '123';

        if (!finalEmail || !nid || !nama) {
          skipCount++;
          continue;
        }

        const existingUser = await prisma.user.findUnique({ where: { email: finalEmail } });
        if (existingUser) { skipCount++; continue; }

        const existingDosen = await prisma.dosen.findUnique({ where: { nid: String(nid) } });
        if (existingDosen) { skipCount++; continue; }

        const pHash = await bcrypt.hash(finalPassword, 10);

        await prisma.user.create({
          data: {
            nama,
            email: finalEmail,
            passwordHash: pHash,
            roleId: roleId.id,
            dosen: {
              create: { nid: String(nid), spesialisasi },
            },
          }
        });
        successCount++;
      } catch (err) {
        skipCount++;
      }
    }

    res.json({ message: `Impor massal selesai. ${successCount} dosen berhasil ditambahkan, ${skipCount} dilewati.` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan impor massal dosen.', error: error.message });
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

// DELETE mata kuliah (cascade delete all schedules, sessions, grades, files, and assignments)
router.delete('/matkul/:id', async (req, res) => {
  try {
    const mkId = parseInt(req.params.id);
    const matkul = await prisma.mataKuliah.findUnique({ where: { id: mkId } });
    if (!matkul) return res.status(404).json({ message: 'Mata kuliah tidak ditemukan.' });

    // Hapus semua relasi dependent bertingkat secara berurutan sesuai arah foreign keys
    await prisma.$transaction([
      // 1. Nilai (tergantung pada KomponenNilai)
      prisma.nilai.deleteMany({ where: { komponen: { mataKuliahId: mkId } } }),
      // 2. KomponenNilai (tergantung pada MataKuliah)
      prisma.komponenNilai.deleteMany({ where: { mataKuliahId: mkId } }),
      // 3. RekapNilaiAkhir (tergantung pada MataKuliah)
      prisma.rekapNilaiAkhir.deleteMany({ where: { mataKuliahId: mkId } }),
      // 4. Materi (tergantung pada MataKuliah)
      prisma.materi.deleteMany({ where: { mataKuliahId: mkId } }),
      // 5. Absensi (tergantung pada SesiPraktikum -> JadwalPraktikum)
      prisma.absensi.deleteMany({ where: { sesi: { jadwal: { mataKuliahId: mkId } } } }),
      // 6. SesiPraktikum (tergantung pada JadwalPraktikum)
      prisma.sesiPraktikum.deleteMany({ where: { jadwal: { mataKuliahId: mkId } } }),
      // 7. PesertaJadwal (tergantung pada JadwalPraktikum)
      prisma.pesertaJadwal.deleteMany({ where: { jadwal: { mataKuliahId: mkId } } }),
      // 8. AjuanPindahJadwal (tergantung pada JadwalPraktikum asal & tujuan)
      prisma.ajuanPindahJadwal.deleteMany({
        where: {
          OR: [
            { jadwalAsal: { mataKuliahId: mkId } },
            { jadwalTujuan: { mataKuliahId: mkId } }
          ]
        }
      }),
      // 9. JadwalPraktikum (tergantung pada MataKuliah)
      prisma.jadwalPraktikum.deleteMany({ where: { mataKuliahId: mkId } }),
      // 10. Pengampu (tergantung pada MataKuliah)
      prisma.pengampu.deleteMany({ where: { mataKuliahId: mkId } }),
      // 11. MataKuliah itu sendiri
      prisma.mataKuliah.delete({ where: { id: mkId } })
    ]);

    res.json({ message: 'Mata kuliah berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus mata kuliah.', error: error.message });
  }
});

// POST impor massal mata kuliah (Excel/CSV)
router.post('/matkul/bulk', async (req, res) => {
  try {
    const { items } = req.body; // Array dari { kode, nama, sks, tipe, deskripsi }
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Data items harus berupa array.' });

    let successCount = 0;
    let skipCount = 0;

    for (const item of items) {
      try {
        const { kode, nama, sks, tipe, deskripsi } = item;
        if (!kode || !nama) {
          skipCount++;
          continue;
        }

        const existingMatkul = await prisma.mataKuliah.findUnique({ where: { kode } });
        if (existingMatkul) { skipCount++; continue; }

        await prisma.mataKuliah.create({
          data: {
            kode, nama,
            sks: sks ? parseInt(sks) : 2,
            tipe: tipe || 'praktikum',
            deskripsi
          }
        });
        successCount++;
      } catch (err) {
        skipCount++;
      }
    }

    res.json({ message: `Impor massal selesai. ${successCount} mata kuliah berhasil ditambahkan, ${skipCount} dilewati.` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan impor massal mata kuliah.', error: error.message });
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
    const { mataKuliahId, asisenId, ruanganId, hari, jamMulai, jamSelesai, semester, kapasitasGrup, kelas } = req.body;

    const mkId = parseInt(mataKuliahId);
    const roomId = ruanganId ? parseInt(ruanganId) : null;
    const astId = asisenId ? parseInt(asisenId) : null;

    // ── 1. VALIDASI BENTROK KELAS ──────────────────────────────
    if (kelas) {
      const classConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          kelas, hari, semester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai }
        },
        include: { mataKuliah: { select: { nama: true } } }
      });
      if (classConflict) {
        return res.status(400).json({ 
          message: `Bentrok Kelas: Kelas ${kelas} sudah dijadwalkan mengikuti praktikum '${classConflict.mataKuliah?.nama}' pada ${hari} jam ${classConflict.jamMulai}-${classConflict.jamSelesai}.` 
        });
      }
    }

    // ── 2. VALIDASI BENTROK RUANGAN ────────────────────────────
    if (roomId) {
      const roomConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          ruanganId: roomId, hari, semester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai }
        },
        include: { ruangan: true, mataKuliah: { select: { nama: true } } }
      });
      if (roomConflict) {
        return res.status(400).json({ 
          message: `Bentrok Ruangan: Ruangan ${roomConflict.ruangan?.nama} sedang digunakan untuk praktikum '${roomConflict.mataKuliah?.nama}' pada ${hari} jam ${roomConflict.jamMulai}-${roomConflict.jamSelesai}.` 
        });
      }
    }

    // ── 3. VALIDASI BENTROK ASISTEN ────────────────────────────
    if (astId) {
      const asistenConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          asisenId: astId, hari, semester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai }
        },
        include: { asisten: { include: { user: { select: { nama: true } } } }, mataKuliah: { select: { nama: true } } }
      });
      if (asistenConflict) {
        return res.status(400).json({ 
          message: `Bentrok Asisten: Asisten ${asistenConflict.asisten?.user?.nama} sedang mendampingi praktikum '${asistenConflict.mataKuliah?.nama}' pada ${hari} jam ${asistenConflict.jamMulai}-${asistenConflict.jamSelesai}.` 
        });
      }
    }

    // ── 4. VALIDASI BENTROK DOSEN ──────────────────────────────
    const pengampuList = await prisma.pengampu.findMany({ where: { mataKuliahId: mkId } });
    const dosenIds = pengampuList.map(p => p.dosenId);
    
    if (dosenIds.length > 0) {
      const dosenConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          hari, semester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai },
          mataKuliah: {
            pengampu: {
              some: { dosenId: { in: dosenIds } }
            }
          }
        },
        include: { 
          mataKuliah: { 
            include: { 
              pengampu: { 
                include: { dosen: { include: { user: { select: { nama: true } } } } } 
              } 
            } 
          } 
        }
      });
      if (dosenConflict) {
        const dosenNama = dosenConflict.mataKuliah?.pengampu[0]?.dosen?.user?.nama || 'Dosen Pengampu';
        return res.status(400).json({ 
          message: `Bentrok Dosen: Dosen pengampu (${dosenNama}) sudah memiliki jadwal bimbingan/kuliah '${dosenConflict.mataKuliah?.nama}' pada ${hari} jam ${dosenConflict.jamMulai}-${dosenConflict.jamSelesai}.` 
        });
      }
    }

    const jadwal = await prisma.jadwalPraktikum.create({
      data: {
        mataKuliahId: mkId,
        asisenId: astId,
        ruanganId: roomId,
        hari, jamMulai, jamSelesai, semester,
        kapasitasGrup: parseInt(kapasitasGrup) || 30,
        kelas
      },
    });
    res.status(201).json({ message: 'Jadwal berhasil ditambahkan tanpa konflik.', data: jadwal });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah jadwal.', error: error.message });
  }
});

// GET semua asisten
router.get('/asisten', async (req, res) => {
  try {
    const asisten = await prisma.asisten.findMany({
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            email: true,
            aktif: true,
            role: true
          }
        }
      },
      orderBy: { stambuk: 'asc' },
    });
    res.json(asisten);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data asisten.' });
  }
});

// GET semua mahasiswa non-asisten
router.get('/mahasiswa/non-asisten', async (req, res) => {
  try {
    const roleMhs = await prisma.role.findUnique({ where: { namaRole: 'praktikan' } });
    const nonAsisten = await prisma.mahasiswa.findMany({
      where: {
        user: {
          roleId: roleMhs.id
        }
      },
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            email: true
          }
        }
      },
      orderBy: { stambuk: 'asc' },
    });
    res.json(nonAsisten);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data mahasiswa non-asisten.' });
  }
});

// POST mempromosikan mahasiswa menjadi asisten
router.post('/asisten/promote', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { mahasiswa: true, asisten: true },
    });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });

    const roleAsisten = await prisma.role.findUnique({ where: { namaRole: 'asisten' } });

    await prisma.user.update({
      where: { id: user.id },
      data: { roleId: roleAsisten.id },
    });

    if (!user.asisten) {
      const stambuk = user.mahasiswa?.stambuk || 'ASISTEN';
      await prisma.asisten.create({
        data: {
          userId: user.id,
          stambuk: stambuk,
        },
      });
    }

    res.json({ message: `${user.nama} berhasil dipromosikan sebagai Asisten.` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mempromosikan asisten.', error: error.message });
  }
});

// POST menurunkan asisten menjadi praktikan biasa
router.post('/asisten/demote', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: { asisten: true },
    });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });

    const roleMhs = await prisma.role.findUnique({ where: { namaRole: 'praktikan' } });

    await prisma.user.update({
      where: { id: user.id },
      data: { roleId: roleMhs.id },
    });

    if (user.asisten) {
      await prisma.asisten.delete({
        where: { id: user.asisten.id },
      });
    }

    res.json({ message: `${user.nama} berhasil diturunkan menjadi Praktikan biasa.` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menurunkan asisten.', error: error.message });
  }
});

// GET semua ruangan
router.get('/ruangan', async (req, res) => {
  try {
    const ruangan = await prisma.ruangan.findMany();
    res.json(ruangan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data ruangan.' });
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
