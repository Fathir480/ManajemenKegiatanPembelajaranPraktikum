require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Routes
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const asisenRoutes = require('./routes/asisten.routes');
const dosenRoutes = require('./routes/dosen.routes');
const praktikanRoutes = require('./routes/praktikan.routes');
const absensiRoutes = require('./routes/absensi.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // React Vite default port
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (untuk file upload materi)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/asisten', asisenRoutes);
app.use('/api/dosen', dosenRoutes);
app.use('/api/praktikan', praktikanRoutes);
app.use('/api/absensi', absensiRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Manajemen Kegiatan Praktikum API berjalan ✅', status: 'OK' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Terjadi kesalahan pada server', error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
