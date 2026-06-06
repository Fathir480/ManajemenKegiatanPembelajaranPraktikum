import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken, getUser } from './lib/auth';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/Dashboard';
import AsistenDashboard from './pages/asisten/Dashboard';
import DosenDashboard from './pages/dosen/Dashboard';
import PraktikanDashboard from './pages/praktikan/Dashboard';

// Admin Subpages
import KelolaMahasiswa from './pages/admin/mahasiswa';
import KelolaAsisten from './pages/admin/asisten';
import KelolaDosen from './pages/admin/dosen';
import KelolaMatkul from './pages/admin/matkul';
import KelolaJadwal from './pages/admin/jadwal';
import ValidasiAjuan from './pages/admin/ajuan';

// Asisten Subpages
import AsistenSesi from './pages/asisten/sesi';
import AsistenAbsensi from './pages/asisten/absensi';
import AsistenNilai from './pages/asisten/nilai';
import AsistenAjuan from './pages/asisten/ajuan';

// Dosen Subpages
import DosenNilai from './pages/dosen/nilai';
import DosenRekap from './pages/dosen/rekap';
import DosenMateri from './pages/dosen/materi';
import DosenAjuan from './pages/dosen/ajuan';

// Praktikan Subpages
import PraktikanQR from './pages/praktikan/qr';
import PraktikanJadwal from './pages/praktikan/jadwal';
import PraktikanAbsensi from './pages/praktikan/absensi';
import PraktikanNilai from './pages/praktikan/nilai';

// Guard: Redirect ke login kalau belum auth
function PrivateRoute({ children, allowedRoles }) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role?.namaRole)) {
    const roleRoutes = {
      admin: '/admin', asisten: '/asisten',
      dosen: '/dosen', praktikan: '/praktikan',
    };
    return <Navigate to={roleRoutes[user.role?.namaRole] || '/login'} replace />;
  }
  return children;
}

// Redirect dari "/" ke dashboard sesuai role
function RootRedirect() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  const routes = { admin: '/admin', asisten: '/asisten', dosen: '/dosen', praktikan: '/praktikan' };
  return <Navigate to={routes[user.role?.namaRole] || '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin */}
        <Route path="/admin" element={
          <PrivateRoute allowedRoles={['admin']}><AdminDashboard /></PrivateRoute>
        } />
        <Route path="/admin/mahasiswa" element={
          <PrivateRoute allowedRoles={['admin']}><KelolaMahasiswa /></PrivateRoute>
        } />
        <Route path="/admin/asisten" element={
          <PrivateRoute allowedRoles={['admin']}><KelolaAsisten /></PrivateRoute>
        } />
        <Route path="/admin/dosen" element={
          <PrivateRoute allowedRoles={['admin']}><KelolaDosen /></PrivateRoute>
        } />
        <Route path="/admin/matkul" element={
          <PrivateRoute allowedRoles={['admin']}><KelolaMatkul /></PrivateRoute>
        } />
        <Route path="/admin/jadwal" element={
          <PrivateRoute allowedRoles={['admin']}><KelolaJadwal /></PrivateRoute>
        } />
        <Route path="/admin/ajuan" element={
          <PrivateRoute allowedRoles={['admin']}><ValidasiAjuan /></PrivateRoute>
        } />

        {/* Asisten */}
        <Route path="/asisten" element={
          <PrivateRoute allowedRoles={['asisten']}><AsistenDashboard /></PrivateRoute>
        } />
        <Route path="/asisten/sesi" element={
          <PrivateRoute allowedRoles={['asisten']}><AsistenSesi /></PrivateRoute>
        } />
        <Route path="/asisten/absensi" element={
          <PrivateRoute allowedRoles={['asisten']}><AsistenAbsensi /></PrivateRoute>
        } />
        <Route path="/asisten/nilai" element={
          <PrivateRoute allowedRoles={['asisten']}><AsistenNilai /></PrivateRoute>
        } />
        <Route path="/asisten/ajuan" element={
          <PrivateRoute allowedRoles={['asisten']}><AsistenAjuan /></PrivateRoute>
        } />

        {/* Dosen */}
        <Route path="/dosen" element={
          <PrivateRoute allowedRoles={['dosen']}><DosenDashboard /></PrivateRoute>
        } />
        <Route path="/dosen/nilai" element={
          <PrivateRoute allowedRoles={['dosen']}><DosenNilai /></PrivateRoute>
        } />
        <Route path="/dosen/rekap" element={
          <PrivateRoute allowedRoles={['dosen']}><DosenRekap /></PrivateRoute>
        } />
        <Route path="/dosen/materi" element={
          <PrivateRoute allowedRoles={['dosen']}><DosenMateri /></PrivateRoute>
        } />
        <Route path="/dosen/ajuan" element={
          <PrivateRoute allowedRoles={['dosen']}><DosenAjuan /></PrivateRoute>
        } />

        {/* Praktikan */}
        <Route path="/praktikan" element={
          <PrivateRoute allowedRoles={['praktikan']}><PraktikanDashboard /></PrivateRoute>
        } />
        <Route path="/praktikan/qr" element={
          <PrivateRoute allowedRoles={['praktikan']}><PraktikanQR /></PrivateRoute>
        } />
        <Route path="/praktikan/jadwal" element={
          <PrivateRoute allowedRoles={['praktikan']}><PraktikanJadwal /></PrivateRoute>
        } />
        <Route path="/praktikan/absensi" element={
          <PrivateRoute allowedRoles={['praktikan']}><PraktikanAbsensi /></PrivateRoute>
        } />
        <Route path="/praktikan/nilai" element={
          <PrivateRoute allowedRoles={['praktikan']}><PraktikanNilai /></PrivateRoute>
        } />

        {/* 404 */}
        <Route path="*" element={
          <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '64px' }}>🔍</span>
            <h2>Halaman Tidak Ditemukan</h2>
            <a href="/" className="btn btn-primary">Kembali ke Home</a>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}
