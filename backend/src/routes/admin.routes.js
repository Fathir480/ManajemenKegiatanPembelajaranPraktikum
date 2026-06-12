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
      include: {
        user: { select: { nama: true, email: true, aktif: true } },
        dosenMataKuliah: {
          include: {
            mataKuliah: true
          }
        }
      },
    });
    res.json(dosen);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data dosen.' });
  }
});

router.post('/dosen', async (req, res) => {
  try {
    const { nama, email, password, nid, spesialisasi, mataKuliahIds } = req.body;
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
        dosen: {
          create: {
            nid,
            spesialisasi,
            dosenMataKuliah: {
              create: (mataKuliahIds || []).map(id => ({
                mataKuliahId: parseInt(id)
              }))
            }
          }
        },
      },
      include: {
        dosen: {
          include: {
            dosenMataKuliah: {
              include: { mataKuliah: true }
            }
          }
        }
      },
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
    const { nid, spesialisasi, nama, email, aktif, mataKuliahIds } = req.body;
    const dosen = await prisma.dosen.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: true },
    });
    if (!dosen) return res.status(404).json({ message: 'Dosen tidak ditemukan.' });

    const finalEmail = email || `${nid.trim()}@lecturer.umi.ac.id`;

    await prisma.$transaction([
      prisma.dosenMataKuliah.deleteMany({
        where: { dosenId: dosen.id }
      }),
      prisma.dosenMataKuliah.createMany({
        data: (mataKuliahIds || []).map(id => ({
          dosenId: dosen.id,
          mataKuliahId: parseInt(id)
        }))
      }),
      prisma.dosen.update({
        where: { id: dosen.id },
        data: { nid, spesialisasi },
      }),
      prisma.user.update({
        where: { id: dosen.userId },
        data: { 
          nama, 
          email: finalEmail, 
          aktif: aktif !== undefined ? aktif : undefined 
        },
      })
    ]);
    
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
      prisma.dosenMataKuliah.deleteMany({ where: { dosenId: dosenId } }),
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
      // Hapus relasi dosen mata kuliah
      prisma.dosenMataKuliah.deleteMany({ where: { mataKuliahId: mkId } }),
      // Hapus peserta kelas untuk kelas matkul ini
      prisma.pesertaKelas.deleteMany({ where: { kelas: { mataKuliahId: mkId } } }),
      // Hapus kelas untuk matkul ini
      prisma.kelas.deleteMany({ where: { mataKuliahId: mkId } }),
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
        kelasRef: {
          include: {
            dosen: { include: { user: { select: { nama: true } } } }
          }
        }
      },
      orderBy: [{ hari: 'asc' }, { jamMulai: 'asc' }],
    });

    const formatted = jadwal.map(j => ({
      ...j,
      dosen: j.kelasRef?.dosen || null
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil jadwal.', error: error.message });
  }
});

router.post('/jadwal', async (req, res) => {
  try {
    const { mataKuliahId, asisenId, ruanganId, dosenId, hari, jamMulai, jamSelesai, kelas, kelasId, semester } = req.body;

    if (!mataKuliahId || !asisenId || !ruanganId || !dosenId || !hari || !jamMulai || !jamSelesai || (!kelas && !kelasId)) {
      return res.status(400).json({ message: 'Semua kolom (Mata Kuliah, Asisten, Ruangan, Dosen, Hari, Sesi, dan Kelas) wajib diisi.' });
    }

    const mkId = parseInt(mataKuliahId);
    const roomId = ruanganId ? parseInt(ruanganId) : null;
    const astId = asisenId ? parseInt(asisenId) : null;
    const kId = kelasId ? parseInt(kelasId) : null;
    const dosId = dosenId ? parseInt(dosenId) : null;
    const finalSemester = semester || '2024/2025 Genap';

    let finalKelas = kelas;
    if (kId) {
      const targetKelas = await prisma.kelas.findUnique({
        where: { id: kId }
      });
      if (targetKelas) {
        finalKelas = targetKelas.namaKelas;
      }
    }

    // ── 1. VALIDASI BENTROK KELAS ──────────────────────────────
    if (kId || finalKelas) {
      const classConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          OR: [
            ...(kId ? [{ kelasId: kId }] : []),
            ...(finalKelas ? [{ kelas: finalKelas }] : [])
          ],
          hari,
          semester: finalSemester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai }
        },
        include: { mataKuliah: { select: { nama: true } } }
      });
      if (classConflict) {
        return res.status(400).json({ 
          message: `Bentrok Kelas: Kelas ${finalKelas || ''} sudah dijadwalkan mengikuti praktikum '${classConflict.mataKuliah?.nama}' pada ${hari} jam ${classConflict.jamMulai}-${classConflict.jamSelesai}.` 
        });
      }
    }

    // ── 2. VALIDASI BENTROK RUANGAN ────────────────────────────
    if (roomId) {
      const roomConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          ruanganId: roomId, hari,
          semester: finalSemester,
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
          asisenId: astId, hari,
          semester: finalSemester,
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
    let finalDosenId = dosId;
    if (!finalDosenId && kId) {
      const targetKelas = await prisma.kelas.findUnique({
        where: { id: kId }
      });
      if (targetKelas) {
        finalDosenId = targetKelas.dosenId;
      }
    }

    if (finalDosenId) {
      const dosenConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          kelasRef: {
            dosenId: finalDosenId
          },
          hari,
          semester: finalSemester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai }
        },
        include: {
          mataKuliah: { select: { nama: true } },
          kelasRef: {
            include: {
              dosen: { include: { user: { select: { nama: true } } } }
            }
          }
        }
      });
      if (dosenConflict) {
        const dosenNama = dosenConflict.kelasRef?.dosen?.user?.nama || 'Dosen';
        return res.status(400).json({ 
          message: `Bentrok Dosen: Dosen ${dosenNama} sudah memiliki jadwal mengampu kelas '${dosenConflict.kelasRef?.namaKelas}' untuk praktikum '${dosenConflict.mataKuliah?.nama}' pada ${hari} jam ${dosenConflict.jamMulai}-${dosenConflict.jamSelesai}.` 
        });
      }
    }

    // Update the class to assign the selected lecturer
    if (kId && dosId) {
      await prisma.kelas.update({
        where: { id: kId },
        data: { dosenId: dosId }
      });
    }

    const jadwal = await prisma.jadwalPraktikum.create({
      data: {
        mataKuliahId: mkId,
        asisenId: astId,
        ruanganId: roomId,
        hari,
        jamMulai,
        jamSelesai,
        semester: finalSemester,
        kelas: finalKelas,
        kelasId: kId
      },
    });
    res.status(201).json({ message: 'Jadwal berhasil ditambahkan tanpa konflik.', data: jadwal });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah jadwal.', error: error.message });
  }
});

// PUT update jadwal
router.put('/jadwal/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { mataKuliahId, asisenId, ruanganId, dosenId, hari, jamMulai, jamSelesai, kelas, kelasId, semester } = req.body;

    if (!mataKuliahId || !asisenId || !ruanganId || !dosenId || !hari || !jamMulai || !jamSelesai || (!kelas && !kelasId)) {
      return res.status(400).json({ message: 'Semua kolom (Mata Kuliah, Asisten, Ruangan, Dosen, Hari, Sesi, dan Kelas) wajib diisi.' });
    }

    const mkId = parseInt(mataKuliahId);
    const roomId = ruanganId ? parseInt(ruanganId) : null;
    const astId = asisenId ? parseInt(asisenId) : null;
    const kId = kelasId ? parseInt(kelasId) : null;
    const dosId = dosenId ? parseInt(dosenId) : null;
    const finalSemester = semester || '2024/2025 Genap';

    let finalKelas = kelas;
    if (kId) {
      const targetKelas = await prisma.kelas.findUnique({
        where: { id: kId }
      });
      if (targetKelas) {
        finalKelas = targetKelas.namaKelas;
      }
    }

    // ── 1. VALIDASI BENTROK KELAS ──────────────────────────────
    if (kId || finalKelas) {
      const classConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          OR: [
            ...(kId ? [{ kelasId: kId }] : []),
            ...(finalKelas ? [{ kelas: finalKelas }] : [])
          ],
          hari,
          semester: finalSemester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai },
          NOT: { id }
        },
        include: { mataKuliah: { select: { nama: true } } }
      });
      if (classConflict) {
        return res.status(400).json({ 
          message: `Bentrok Kelas: Kelas ${finalKelas || ''} sudah dijadwalkan mengikuti praktikum '${classConflict.mataKuliah?.nama}' pada ${hari} jam ${classConflict.jamMulai}-${classConflict.jamSelesai}.` 
        });
      }
    }

    // ── 2. VALIDASI BENTROK RUANGAN ────────────────────────────
    if (roomId) {
      const roomConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          ruanganId: roomId, hari,
          semester: finalSemester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai },
          NOT: { id }
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
          asisenId: astId, hari,
          semester: finalSemester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai },
          NOT: { id }
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
    let finalDosenId = dosId;
    if (!finalDosenId && kId) {
      const targetKelas = await prisma.kelas.findUnique({
        where: { id: kId }
      });
      if (targetKelas) {
        finalDosenId = targetKelas.dosenId;
      }
    }

    if (finalDosenId) {
      const dosenConflict = await prisma.jadwalPraktikum.findFirst({
        where: {
          kelasRef: {
            dosenId: finalDosenId
          },
          hari,
          semester: finalSemester,
          jamMulai: { lt: jamSelesai },
          jamSelesai: { gt: jamMulai },
          NOT: { id }
        },
        include: {
          mataKuliah: { select: { nama: true } },
          kelasRef: {
            include: {
              dosen: { include: { user: { select: { nama: true } } } }
            }
          }
        }
      });
      if (dosenConflict) {
        const dosenNama = dosenConflict.kelasRef?.dosen?.user?.nama || 'Dosen';
        return res.status(400).json({ 
          message: `Bentrok Dosen: Dosen ${dosenNama} sudah memiliki jadwal mengampu kelas '${dosenConflict.kelasRef?.namaKelas}' untuk praktikum '${dosenConflict.mataKuliah?.nama}' pada ${hari} jam ${dosenConflict.jamMulai}-${dosenConflict.jamSelesai}.` 
        });
      }
    }

    // Update the class to assign the selected lecturer
    if (kId && dosId) {
      await prisma.kelas.update({
        where: { id: kId },
        data: { dosenId: dosId }
      });
    }

    const updatedJadwal = await prisma.jadwalPraktikum.update({
      where: { id },
      data: {
        mataKuliahId: mkId,
        asisenId: astId,
        ruanganId: roomId,
        hari,
        jamMulai,
        jamSelesai,
        semester: finalSemester,
        kelas: finalKelas,
        kelasId: kId
      },
    });
    res.json({ message: 'Jadwal berhasil diubah tanpa konflik.', data: updatedJadwal });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengubah jadwal.', error: error.message });
  }
});

// DELETE hapus jadwal
router.delete('/jadwal/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    await prisma.$transaction([
      prisma.pesertaJadwal.deleteMany({ where: { jadwalId: id } }),
      prisma.sesiPraktikum.deleteMany({ where: { jadwalId: id } }),
      prisma.ajuanPindahJadwal.deleteMany({
        where: {
          OR: [
            { jadwalAsalId: id },
            { jadwalTujuanId: id }
          ]
        }
      }),
      prisma.jadwalPraktikum.delete({ where: { id } })
    ]);

    res.json({ message: 'Jadwal berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus jadwal.', error: error.message });
  }
});

// POST impor massal jadwal (Excel)
router.post('/jadwal/bulk', async (req, res) => {
  try {
    const { items } = req.body; // Array of { courseCode, assistantStambuk, roomCode, lecturerNid, day, jamMulai, jamSelesai, className, semester }
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Data items harus berupa array.' });

    let successCount = 0;
    let skipCount = 0;
    const errors = [];

    for (const item of items) {
      try {
        const { courseCode, assistantStambuk, roomCode, lecturerNid, day, jamMulai, jamSelesai, className, semester } = item;

        if (!courseCode || !roomCode || !day || !jamMulai || !jamSelesai || !className) {
          skipCount++;
          errors.push(`Jalur dilewati karena data tidak lengkap untuk kelas ${className || '-'}`);
          continue;
        }

        const finalSemester = semester || '2024/2025 Genap';

        // Validate Day enum
        const validDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        let resolvedDay = day.trim();
        // Capitalize day name (e.g. senin -> Senin)
        resolvedDay = resolvedDay.charAt(0).toUpperCase() + resolvedDay.slice(1).toLowerCase();
        if (!validDays.includes(resolvedDay)) {
          // Check English names
          const engToIndo = {
            'monday': 'Senin', 'tuesday': 'Selasa', 'wednesday': 'Rabu',
            'thursday': 'Kamis', 'friday': 'Jumat', 'saturday': 'Sabtu'
          };
          const engLower = resolvedDay.toLowerCase();
          if (engToIndo[engLower]) {
            resolvedDay = engToIndo[engLower];
          } else {
            skipCount++;
            errors.push(`Hari '${day}' tidak valid. Gunakan Senin-Sabtu atau Monday-Saturday.`);
            continue;
          }
        }

        // 1. Resolve MataKuliah by kode
        const mk = await prisma.mataKuliah.findUnique({
          where: { kode: courseCode }
        });
        if (!mk) {
          skipCount++;
          errors.push(`Matakuliah dengan kode ${courseCode} tidak ditemukan.`);
          continue;
        }

        // 2. Resolve Ruangan by kode
        const room = await prisma.ruangan.findUnique({
          where: { kode: roomCode }
        });
        if (!room) {
          skipCount++;
          errors.push(`Ruangan dengan kode ${roomCode} tidak ditemukan.`);
          continue;
        }

        // 3. Resolve Asisten by stambuk
        let astId = null;
        if (assistantStambuk) {
          const ast = await prisma.asisten.findFirst({
            where: { stambuk: String(assistantStambuk) }
          });
          if (ast) {
            astId = ast.id;
          } else {
            skipCount++;
            errors.push(`Asisten dengan stambuk ${assistantStambuk} tidak ditemukan.`);
            continue;
          }
        }

        // 4. Resolve Dosen by NID
        let dosId = null;
        if (lecturerNid) {
          const dos = await prisma.dosen.findUnique({
            where: { nid: String(lecturerNid) }
          });
          if (dos) {
            dosId = dos.id;
          } else {
            skipCount++;
            errors.push(`Dosen dengan NID ${lecturerNid} tidak ditemukan.`);
            continue;
          }
        }

        // 5. Resolve Kelas by namaKelas, mataKuliahId, and semester
        let kId = null;
        const targetKelas = await prisma.kelas.findFirst({
          where: {
            namaKelas: className,
            mataKuliahId: mk.id
          }
        });
        if (targetKelas) {
          kId = targetKelas.id;
          // auto update dosen if provided
          if (dosId && targetKelas.dosenId !== dosId) {
            await prisma.kelas.update({
              where: { id: targetKelas.id },
              data: { dosenId: dosId }
            });
          }
        } else {
          // If class doesn't exist, create it dynamically
          const newKelas = await prisma.kelas.create({
            data: {
              namaKelas: className,
              mataKuliahId: mk.id,
              dosenId: dosId || null
            }
          });
          kId = newKelas.id;
        }

        // ── 6. VALIDASI BENTROK KELAS ──────────────────────────────
        const classConflict = await prisma.jadwalPraktikum.findFirst({
          where: {
            OR: [
              { kelasId: kId },
              { kelas: className }
            ],
            hari: resolvedDay,
            semester: finalSemester,
            jamMulai: { lt: jamSelesai },
            jamSelesai: { gt: jamMulai }
          }
        });
        if (classConflict) {
          skipCount++;
          errors.push(`Bentrok Kelas: Kelas ${className} sudah dijadwalkan pada hari ${resolvedDay} jam ${jamMulai}-${jamSelesai}.`);
          continue;
        }

        // ── 7. VALIDASI BENTROK RUANGAN ────────────────────────────
        const roomConflict = await prisma.jadwalPraktikum.findFirst({
          where: {
            ruanganId: room.id,
            hari: resolvedDay,
            semester: finalSemester,
            jamMulai: { lt: jamSelesai },
            jamSelesai: { gt: jamMulai }
          }
        });
        if (roomConflict) {
          skipCount++;
          errors.push(`Bentrok Ruangan: Ruangan ${roomCode} sedang digunakan pada hari ${resolvedDay} jam ${jamMulai}-${jamSelesai}.`);
          continue;
        }

        // ── 8. VALIDASI BENTROK ASISTEN ────────────────────────────
        if (astId) {
          const asistenConflict = await prisma.jadwalPraktikum.findFirst({
            where: {
              asisenId: astId,
              hari: resolvedDay,
              semester: finalSemester,
              jamMulai: { lt: jamSelesai },
              jamSelesai: { gt: jamMulai }
            }
          });
          if (asistenConflict) {
            skipCount++;
            errors.push(`Bentrok Asisten: Asisten ${assistantStambuk} sedang mendampingi praktikum lain pada hari ${resolvedDay} jam ${jamMulai}-${jamSelesai}.`);
            continue;
          }
        }

        // ── 9. VALIDASI BENTROK DOSEN ──────────────────────────────
        if (dosId) {
          const dosenConflict = await prisma.jadwalPraktikum.findFirst({
            where: {
              kelasRef: {
                dosenId: dosId
              },
              hari: resolvedDay,
              semester: finalSemester,
              jamMulai: { lt: jamSelesai },
              jamSelesai: { gt: jamMulai }
            }
          });
          if (dosenConflict) {
            skipCount++;
            errors.push(`Bentrok Dosen: Dosen ${lecturerNid} sudah memiliki jadwal mengajar pada hari ${resolvedDay} jam ${jamMulai}-${jamSelesai}.`);
            continue;
          }
        }

        // Create schedule
        await prisma.jadwalPraktikum.create({
          data: {
            mataKuliahId: mk.id,
            asisenId: astId,
            ruanganId: room.id,
            dosenId: dosId,
            hari: resolvedDay,
            jamMulai,
            jamSelesai,
            semester: finalSemester,
            kelas: className,
            kelasId: kId
          }
        });
        successCount++;
      } catch (err) {
        skipCount++;
        errors.push(`Error baris: ${err.message}`);
      }
    }

    let message = `Impor massal selesai. ${successCount} jadwal berhasil ditambahkan, ${skipCount} dilewati.`;
    if (errors.length > 0) {
      message += `\nDetail error:\n${errors.slice(0, 10).join('\n')}`;
      if (errors.length > 10) message += `\n...dan ${errors.length - 10} error lainnya.`;
    }
    res.json({ message });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan impor massal jadwal.', error: error.message });
  }
});

// POST verifikasi jadwal semester & generate sesi absensi
router.post('/jadwal/verify-semester', async (req, res) => {
  try {
    const { tanggalMulai, tanggalSelesai, semester } = req.body;
    if (!tanggalMulai || !tanggalSelesai) {
      return res.status(400).json({ message: 'Tanggal mulai dan tanggal selesai wajib diisi.' });
    }

    const start = new Date(tanggalMulai);
    const end = new Date(tanggalSelesai);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Format tanggal tidak valid.' });
    }

    if (start > end) {
      return res.status(400).json({ message: 'Tanggal mulai tidak boleh melebihi tanggal selesai.' });
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 180) {
      return res.status(400).json({ message: 'Rentang tanggal tidak boleh melebihi 6 bulan (180 hari).' });
    }

    const finalSemester = semester || '2024/2025 Genap';

    // Simpan/Upsert konfigurasi semester ke database
    await prisma.semesterConfig.upsert({
      where: { semester: finalSemester },
      update: {
        tanggalMulai: start,
        tanggalSelesai: end
      },
      create: {
        semester: finalSemester,
        tanggalMulai: start,
        tanggalSelesai: end
      }
    });

    // Update semua jadwal aktif agar semester-nya sesuai dengan semester yang diverifikasi
    await prisma.jadwalPraktikum.updateMany({
      where: { aktif: true },
      data: { semester: finalSemester }
    });

    // Ambil semua jadwal aktif untuk semester ini
    const jadwalList = await prisma.jadwalPraktikum.findMany({
      where: {
        aktif: true,
        semester: finalSemester
      }
    });

    const dayIndoToNum = {
      'Senin': 1,
      'Selasa': 2,
      'Rabu': 3,
      'Kamis': 4,
      'Jumat': 5,
      'Sabtu': 6
    };

    let totalSesiCreated = 0;

    // Loop setiap jadwal
    for (const j of jadwalList) {
      const targetDayNum = dayIndoToNum[j.hari];
      if (targetDayNum === undefined) continue;

      let current = new Date(start);
      let pertemuan = 1;

      // Hapus sesi praktikum lama untuk jadwal ini untuk menghindari duplikat
      // Cascade akan menghapus absensi & nilai terkait sesi tersebut jika ada
      await prisma.sesiPraktikum.deleteMany({
        where: { jadwalId: j.id }
      });

      // Cari semua tanggal yang harinya cocok antara start dan end
      while (current <= end) {
        if (current.getDay() === targetDayNum) {
          // Buat SesiPraktikum
          await prisma.sesiPraktikum.create({
            data: {
              jadwalId: j.id,
              tanggal: new Date(current),
              pertemuanKe: pertemuan,
              topik: `Pertemuan ke-${pertemuan}`
            }
          });
          pertemuan++;
          totalSesiCreated++;
        }
        current.setDate(current.getDate() + 1);
      }
    }

    res.json({
      message: `Verifikasi jadwal semester sukses. Terbentuk ${totalSesiCreated} sesi praktikum untuk ${jadwalList.length} jadwal aktif.`
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan verifikasi semester.', error: error.message });
  }
});

// GET konfigurasi semester
router.get('/jadwal/semester-config/:semester', async (req, res) => {
  try {
    const { semester } = req.params;
    const config = await prisma.semesterConfig.findUnique({
      where: { semester }
    });
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil konfigurasi semester.', error: error.message });
  }
});

// DELETE batalkan verifikasi semester
router.delete('/jadwal/semester-config/:semester', async (req, res) => {
  try {
    const { semester } = req.params;

    // 1. Hapus SemesterConfig
    await prisma.semesterConfig.deleteMany({
      where: { semester }
    });

    // 2. Ambil semua jadwal untuk semester ini
    const jadwalList = await prisma.jadwalPraktikum.findMany({
      where: { semester }
    });
    const jadwalIds = jadwalList.map(j => j.id);

    // 3. Hapus semua sesi praktikum terkait jadwal-jadwal tersebut
    if (jadwalIds.length > 0) {
      await prisma.sesiPraktikum.deleteMany({
        where: { jadwalId: { in: jadwalIds } }
      });
    }

    res.json({ message: `Semester ${semester} berhasil dibatalkan. Seluruh sesi praktikum telah dihapus.` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membatalkan semester.', error: error.message });
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
    const ruangan = await prisma.ruangan.findMany({
      orderBy: { kode: 'asc' }
    });
    res.json(ruangan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data ruangan.' });
  }
});

// POST buat ruangan baru
router.post('/ruangan', async (req, res) => {
  try {
    const { kode, nama, kapasitas } = req.body;
    if (!kode || !nama) {
      return res.status(400).json({ message: 'Kode dan nama ruangan wajib diisi.' });
    }

    const existing = await prisma.ruangan.findUnique({ where: { kode } });
    if (existing) {
      return res.status(400).json({ message: 'Kode ruangan sudah terdaftar.' });
    }

    const newRuangan = await prisma.ruangan.create({
      data: {
        kode,
        nama,
        kapasitas: kapasitas ? parseInt(kapasitas) : null
      }
    });

    res.status(201).json(newRuangan);
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat ruangan baru.', error: error.message });
  }
});

// PUT update ruangan
router.put('/ruangan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { kode, nama, kapasitas } = req.body;
    if (!kode || !nama) {
      return res.status(400).json({ message: 'Kode dan nama ruangan wajib diisi.' });
    }

    const existing = await prisma.ruangan.findFirst({
      where: {
        kode,
        NOT: { id: parseInt(id) }
      }
    });
    if (existing) {
      return res.status(400).json({ message: 'Kode ruangan sudah digunakan oleh ruangan lain.' });
    }

    const updated = await prisma.ruangan.update({
      where: { id: parseInt(id) },
      data: {
        kode,
        nama,
        kapasitas: kapasitas ? parseInt(kapasitas) : null
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengubah data ruangan.', error: error.message });
  }
});

// DELETE ruangan
router.delete('/ruangan/:id', async (req, res) => {
  try {
    await prisma.ruangan.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Ruangan berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus ruangan.', error: error.message });
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

// ── MANAJEMEN KELAS ──────────────────────────────────────────────

// GET semua kelas
router.get('/kelas', async (req, res) => {
  try {
    const kelas = await prisma.kelas.findMany({
      include: {
        mataKuliah: true,
        dosen: {
          include: { user: { select: { nama: true } } }
        },
        _count: {
          select: { pesertaKelas: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(kelas);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data kelas.', error: error.message });
  }
});

// POST buat kelas baru (otomatis / bulk)
router.post('/kelas', async (req, res) => {
  try {
    const { mataKuliahId, dosenId, jumlahKelas, namaKelas } = req.body;
    
    const mkId = parseInt(mataKuliahId);
    const dId = dosenId ? parseInt(dosenId) : null;
    const count = parseInt(jumlahKelas) || 1;

    if (namaKelas) {
      // Pembuatan kelas tunggal manual
      const existing = await prisma.kelas.findUnique({
        where: {
          namaKelas_mataKuliahId: {
            namaKelas,
            mataKuliahId: mkId
          }
        }
      });

      if (existing) {
        return res.status(400).json({ message: 'Kelas dengan mata kuliah tersebut sudah ada.' });
      }

      const newKelas = await prisma.kelas.create({
        data: {
          namaKelas,
          mataKuliahId: mkId,
          dosenId: dId
        }
      });
      return res.status(201).json(newKelas);
    }

    // Pembuatan otomatis berurutan (A1, A2, A3...)
    // 1. Dapatkan kelas yang sudah ada untuk matkul ini
    const existingClasses = await prisma.kelas.findMany({
      where: {
        mataKuliahId: mkId
      }
    });

    // 2. Cari angka maksimal dari nama kelas berformat A<angka>
    const numbers = existingClasses
      .map(k => {
        const match = k.namaKelas.match(/^A(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);

    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;

    // 3. Buat kelas sebanyak `count`
    const createdClasses = [];
    for (let i = 1; i <= count; i++) {
      const nextNum = maxNumber + i;
      const nextClassName = `A${nextNum}`;

      const newKelas = await prisma.kelas.create({
        data: {
          namaKelas: nextClassName,
          mataKuliahId: mkId,
          dosenId: dId
        }
      });
      createdClasses.push(newKelas);
    }

    res.status(201).json({
      message: `Berhasil membuat ${count} kelas secara otomatis.`,
      data: createdClasses
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat kelas.', error: error.message });
  }
});


// PUT update kelas
router.put('/kelas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { namaKelas, mataKuliahId, dosenId, aktif } = req.body;

    const updated = await prisma.kelas.update({
      where: { id: parseInt(id) },
      data: {
        namaKelas,
        mataKuliahId: parseInt(mataKuliahId),
        dosenId: dosenId ? parseInt(dosenId) : null,
        aktif: aktif === 'true' || aktif === true
      }
    });
    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ message: 'Data kelas duplikat.' });
    res.status(500).json({ message: 'Gagal update kelas.', error: error.message });
  }
});

// DELETE kelas
router.delete('/kelas/:id', async (req, res) => {
  try {
    await prisma.kelas.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Kelas berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus kelas.', error: error.message });
  }
});

// GET peserta kelas
router.get('/kelas/:id/peserta', async (req, res) => {
  try {
    const peserta = await prisma.pesertaKelas.findMany({
      where: { kelasId: parseInt(req.params.id) },
      include: {
        mahasiswa: {
          include: { user: { select: { nama: true } } }
        }
      }
    });
    res.json(peserta);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil peserta kelas.', error: error.message });
  }
});

// POST tambah peserta kelas (bulk)
router.post('/kelas/:id/peserta', async (req, res) => {
  try {
    const { id } = req.params;
    const { mahasiswaIds } = req.body; // array of mahasiswaId
    
    if (!mahasiswaIds || !Array.isArray(mahasiswaIds)) {
      return res.status(400).json({ message: 'mahasiswaIds harus berupa array.' });
    }

    // 1. Ambil info kelas target untuk mendapatkan mataKuliahId
    const targetKelas = await prisma.kelas.findUnique({
      where: { id: parseInt(id) }
    });
    if (!targetKelas) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    // 2. Cek apakah ada mahasiswa yang sudah terdaftar di kelas lain untuk matkul yang sama
    const duplicateEnrollments = await prisma.pesertaKelas.findFirst({
      where: {
        mahasiswaId: { in: mahasiswaIds.map(mid => parseInt(mid)) },
        kelas: {
          mataKuliahId: targetKelas.mataKuliahId,
          NOT: {
            id: targetKelas.id // kecualikan kelas target itu sendiri
          }
        }
      },
      include: {
        mahasiswa: { include: { user: { select: { nama: true } } } },
        kelas: true
      }
    });

    if (duplicateEnrollments) {
      return res.status(400).json({
        message: `Mahasiswa '${duplicateEnrollments.mahasiswa.user.nama}' sudah terdaftar di kelas '${duplicateEnrollments.kelas.namaKelas}' untuk mata kuliah yang sama.`
      });
    }

    const data = mahasiswaIds.map(mhsId => ({
      kelasId: parseInt(id),
      mahasiswaId: parseInt(mhsId)
    }));

    await prisma.pesertaKelas.createMany({
      data,
      skipDuplicates: true // abaikan jika sudah ada
    });

    res.json({ message: 'Peserta berhasil ditambahkan.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambah peserta kelas.', error: error.message });
  }
});

// DELETE hapus peserta kelas
router.delete('/kelas/:id/peserta/:mahasiswaId', async (req, res) => {
  try {
    await prisma.pesertaKelas.delete({
      where: {
        kelasId_mahasiswaId: {
          kelasId: parseInt(req.params.id),
          mahasiswaId: parseInt(req.params.mahasiswaId)
        }
      }
    });
    res.json({ message: 'Peserta berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus peserta kelas.', error: error.message });
  }
});

// GET detail absensi kelas (list mahasiswa & sesi & status absensi)
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
      sessions: sesi.map(s => ({
        id: s.id,
        tanggal: s.tanggal,
        pertemuanKe: s.pertemuanKe,
        topik: s.topik
      })),
      attendance: absensi
    });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data absensi kelas.', error: error.message });
  }
});

// PUT ubah tanggal sesi absensi
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

    const updatedSesi = await prisma.sesiPraktikum.update({
      where: { id: sesiId },
      data: { tanggal: start }
    });

    res.json({ message: 'Tanggal absensi berhasil diubah.', updatedSesi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengubah tanggal absensi.', error: error.message });
  }
});

// PUT perbarui status absensi mahasiswa manual
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

    const absensi = await prisma.absensi.upsert({
      where: {
        sesiId_mahasiswaId: {
          sesiId: parseInt(sesiId),
          mahasiswaId: parseInt(mahasiswaId)
        }
      },
      update: { status },
      create: {
        sesiId: parseInt(sesiId),
        mahasiswaId: parseInt(mahasiswaId),
        status,
        metode: 'manual'
      }
    });

    res.json({ message: 'Absensi berhasil diperbarui.', absensi });
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui absensi.', error: error.message });
  }
});

// POST impor massal kelas (Excel/CSV)
router.post('/kelas/bulk', async (req, res) => {
  try {
    const { items } = req.body; // Array dari { namaKelas, mataKuliahKode, dosenNID }
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Data items harus berupa array.' });

    let successCount = 0;
    let skipCount = 0;

    for (const item of items) {
      try {
        const { namaKelas, mataKuliahKode, dosenNID } = item;
        if (!namaKelas || !mataKuliahKode) {
          skipCount++;
          continue;
        }

        // Cari mata kuliah berdasarkan kode
        const mk = await prisma.mataKuliah.findUnique({
          where: { kode: String(mataKuliahKode).trim() }
        });
        if (!mk) {
          skipCount++;
          continue;
        }

        // Cari dosen berdasarkan NID jika diberikan
        let dId = null;
        if (dosenNID) {
          const dosen = await prisma.dosen.findUnique({
            where: { nid: String(dosenNID).trim() }
          });
          if (dosen) {
            dId = dosen.id;
          }
        }

        // Cek apakah sudah ada kelas dengan kombinasi [namaKelas, mataKuliahId]
        const existing = await prisma.kelas.findUnique({
          where: {
            namaKelas_mataKuliahId: {
              namaKelas: String(namaKelas).trim(),
              mataKuliahId: mk.id
            }
          }
        });

        if (existing) {
          // Jika kelas sudah ada, kita update Dosen pengampunya jika diubah
          await prisma.kelas.update({
            where: { id: existing.id },
            data: { dosenId: dId }
          });
          successCount++;
        } else {
          // Jika belum ada, buat baru
          await prisma.kelas.create({
            data: {
              namaKelas: String(namaKelas).trim(),
              mataKuliahId: mk.id,
              dosenId: dId
            }
          });
          successCount++;
        }
      } catch (err) {
        skipCount++;
      }
    }

    res.json({ message: `Impor massal selesai. ${successCount} kelas berhasil ditambahkan/diperbarui, ${skipCount} dilewati.` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan impor massal kelas.', error: error.message });
  }
});

// POST impor massal ruangan/lab (Excel/CSV)
router.post('/ruangan/bulk', async (req, res) => {
  try {
    const { items } = req.body; // Array dari { kode, nama, kapasitas }
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Data items harus berupa array.' });

    let successCount = 0;
    let skipCount = 0;

    for (const item of items) {
      try {
        const { kode, nama, kapasitas } = item;
        if (!kode || !nama) {
          skipCount++;
          continue;
        }

        const existing = await prisma.ruangan.findUnique({
          where: { kode: String(kode).trim() }
        });

        const cap = kapasitas ? parseInt(kapasitas) : null;

        if (existing) {
          // Update data jika sudah ada
          await prisma.ruangan.update({
            where: { id: existing.id },
            data: { nama: String(nama).trim(), kapasitas: cap }
          });
          successCount++;
        } else {
          // Buat baru jika belum ada
          await prisma.ruangan.create({
            data: {
              kode: String(kode).trim(),
              nama: String(nama).trim(),
              kapasitas: cap
            }
          });
          successCount++;
        }
      } catch (err) {
        skipCount++;
      }
    }

    res.json({ message: `Impor massal selesai. ${successCount} ruangan/lab berhasil ditambahkan/diperbarui, ${skipCount} dilewati.` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal melakukan impor massal ruangan.', error: error.message });
  }
});

// ── REKAP NILAI (ADMIN VIEW) ─────────────────────────────────

// GET nilai mahasiswa di suatu kelas
router.get('/nilai/kelas/:kelasId', async (req, res) => {
  try {
    const kelasId = parseInt(req.params.kelasId);
    
    // 1. Ambil detail kelas
    const kelas = await prisma.kelas.findUnique({
      where: { id: kelasId },
      include: {
        mataKuliah: true,
      }
    });
    
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });

    // 2. Ambil komponen nilai untuk mata kuliah tersebut
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
    // 3. Ambil daftar peserta kelas beserta user-nya
    const peserta = await prisma.pesertaKelas.findMany({
      where: { kelasId },
      include: {
        mahasiswa: {
          include: {
            user: { select: { nama: true } }
          }
        }
      }
    });

    // 4. Ambil semua nilai untuk peserta kelas ini pada mata kuliah ini
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

    // Format response agar mudah di-consume oleh frontend
    const formattedStudents = peserta.map(p => {
      const mhs = p.mahasiswa;
      // Filter nilai milik mahasiswa ini
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

module.exports = router;

