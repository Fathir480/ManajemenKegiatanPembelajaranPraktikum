const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Mulai seeding database...');

  // ── ROLES ──────────────────────────────────────────────
  // Sudah dibuat via db push dari schema enum, tapi kita pastikan ada
  // (Prisma tidak auto-seed roles karena pakai enum, bukan tabel terpisah)

  // ── HASH PASSWORD ──────────────────────────────────────
  const hash = (plain) => bcrypt.hash(plain, 10);

  // ── ADMIN ──────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@praktikum.ac.id' },
    update: {},
    create: {
      nama: 'Administrator',
      email: 'admin@praktikum.ac.id',
      passwordHash: await hash('admin123'),
      roleId: 1, // admin
    },
  });
  console.log('✅ Admin dibuat:', adminUser.email);

  // ── DOSEN ──────────────────────────────────────────────
  const dosenUser = await prisma.user.upsert({
    where: { email: 'dosen@praktikum.ac.id' },
    update: {},
    create: {
      nama: 'Dr. Budi Santoso, M.Kom',
      email: 'dosen@praktikum.ac.id',
      passwordHash: await hash('dosen123'),
      roleId: 2, // dosen
      dosen: {
        create: {
          nid: 'NID-001',
          spesialisasi: 'Pemrograman Web',
        },
      },
    },
  });
  console.log('✅ Dosen dibuat:', dosenUser.email);

  // ── ASISTEN ────────────────────────────────────────────
  const asisenUser = await prisma.user.upsert({
    where: { email: 'asisten@praktikum.ac.id' },
    update: {},
    create: {
      nama: 'Andi Pratama',
      email: 'asisten@praktikum.ac.id',
      passwordHash: await hash('asisten123'),
      roleId: 3, // asisten
      asisten: {
        create: {
          stambuk: 'H071221001',
        },
      },
    },
  });
  console.log('✅ Asisten dibuat:', asisenUser.email);

  // ── PRAKTIKAN ──────────────────────────────────────────
  const praktikanUser = await prisma.user.upsert({
    where: { email: 'mahasiswa@praktikum.ac.id' },
    update: {},
    create: {
      nama: 'Siti Rahmawati',
      email: 'mahasiswa@praktikum.ac.id',
      passwordHash: await hash('mahasiswa123'),
      roleId: 4, // praktikan
      mahasiswa: {
        create: {
          stambuk: 'H071231001',
          angkatan: 2023,
          programStudi: 'Sistem Informasi',
        },
      },
    },
  });
  console.log('✅ Praktikan dibuat:', praktikanUser.email);

  // ── MATA KULIAH ────────────────────────────────────────
  const mk1 = await prisma.mataKuliah.upsert({
    where: { kode: 'MK001' },
    update: {},
    create: { kode: 'MK001', nama: 'Pemrograman Web', sks: 3, tipe: 'keduanya' },
  });
  const mk2 = await prisma.mataKuliah.upsert({
    where: { kode: 'MK002' },
    update: {},
    create: { kode: 'MK002', nama: 'Basis Data', sks: 3, tipe: 'keduanya' },
  });
  console.log('✅ Mata kuliah dibuat');

  // ── RUANGAN ────────────────────────────────────────────
  const ruangan = await prisma.ruangan.upsert({
    where: { kode: 'LAB-A' },
    update: {},
    create: { kode: 'LAB-A', nama: 'Lab Komputer A', kapasitas: 30 },
  });
  console.log('✅ Ruangan dibuat');

  // ── JADWAL PRAKTIKUM ───────────────────────────────────
  const dosen = await prisma.dosen.findUnique({ where: { userId: dosenUser.id } });
  const asisten = await prisma.asisten.findUnique({ where: { userId: asisenUser.id } });

  await prisma.pengampu.upsert({
    where: { dosenId_mataKuliahId_semester: { dosenId: dosen.id, mataKuliahId: mk1.id, semester: '2024/2025 Genap' } },
    update: {},
    create: { dosenId: dosen.id, mataKuliahId: mk1.id, semester: '2024/2025 Genap' },
  });

  const jadwal = await prisma.jadwalPraktikum.upsert({
    where: { id: 1 },
    update: {},
    create: {
      mataKuliahId: mk1.id,
      asisenId: asisten.id,
      ruanganId: ruangan.id,
      hari: 'Rabu',
      jamMulai: '08:00',
      jamSelesai: '10:00',
      semester: '2024/2025 Genap',
      kapasitasGrup: 30,
    },
  });

  // ── DAFTARKAN MAHASISWA KE JADWAL ──────────────────────
  const mahasiswa = await prisma.mahasiswa.findUnique({ where: { userId: praktikanUser.id } });
  await prisma.pesertaJadwal.upsert({
    where: { jadwalId_mahasiswaId: { jadwalId: jadwal.id, mahasiswaId: mahasiswa.id } },
    update: {},
    create: { jadwalId: jadwal.id, mahasiswaId: mahasiswa.id },
  });
  console.log('✅ Jadwal & peserta dibuat');

  console.log('\n🎉 Seeding selesai!');
}

main()
  .catch((e) => { console.error('❌ Error seeding:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
