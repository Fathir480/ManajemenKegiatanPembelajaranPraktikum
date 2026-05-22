import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken, getUser } from './lib/auth';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/Dashboard';
import AsistenDashboard from './pages/asisten/Dashboard';
import DosenDashboard from './pages/dosen/Dashboard';
import PraktikanDashboard from './pages/praktikan/Dashboard';

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

        {/* Asisten */}
        <Route path="/asisten" element={
          <PrivateRoute allowedRoles={['asisten']}><AsistenDashboard /></PrivateRoute>
        } />

        {/* Dosen */}
        <Route path="/dosen" element={
          <PrivateRoute allowedRoles={['dosen']}><DosenDashboard /></PrivateRoute>
        } />

        {/* Praktikan */}
        <Route path="/praktikan" element={
          <PrivateRoute allowedRoles={['praktikan']}><PraktikanDashboard /></PrivateRoute>
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
