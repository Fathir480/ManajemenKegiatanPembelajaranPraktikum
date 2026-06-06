const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const input = email; // Keep Using email as the parameter name from request body for compatibility, but we accept email, stambuk, or NID

    if (!input || !password) {
      return res.status(400).json({ message: 'Email/Stambuk/NID dan password wajib diisi.' });
    }

    let user = null;

    if (input.includes('@')) {
      // Cari user berdasarkan email
      user = await prisma.user.findUnique({
        where: { email: input },
        include: { role: true },
      });
    } else {
      // Cari mahasiswa berdasarkan stambuk
      const mhs = await prisma.mahasiswa.findUnique({
        where: { stambuk: input },
        include: { user: { include: { role: true } } },
      });

      if (mhs) {
        user = mhs.user;
      } else {
        // Cari asisten berdasarkan stambuk
        const asis = await prisma.asisten.findFirst({
          where: { stambuk: input },
          include: { user: { include: { role: true } } },
        });

        if (asis) {
          user = asis.user;
        } else {
          // Cari dosen berdasarkan NID
          const dsn = await prisma.dosen.findUnique({
            where: { nid: input },
            include: { user: { include: { role: true } } },
          });

          if (dsn) {
            user = dsn.user;
          }
        }
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Email, Stambuk, atau NID salah.' });
    }

    if (!user.aktif) {
      return res.status(403).json({ message: 'Akun Anda tidak aktif. Hubungi admin.' });
    }

    // Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email/Stambuk/NID atau password salah.' });
    }

    // Buat JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        nama: user.nama,
        role: user.role.namaRole,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Kembalikan data user tanpa password
    const { passwordHash, ...userSafe } = user;

    res.json({
      message: 'Login berhasil.',
      token,
      user: userSafe,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// GET /api/auth/me — Cek token & ambil data user yang sedang login
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        role: true,
        mahasiswa: true,
        dosen: true,
        asisten: true,
      },
    });

    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });

    const { passwordHash, ...userSafe } = user;
    res.json({ user: userSafe });
  } catch (error) {
    res.status(403).json({ message: 'Token tidak valid.' });
  }
});

module.exports = router;
