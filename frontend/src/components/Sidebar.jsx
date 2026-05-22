import { NavLink } from 'react-router-dom';
import { getUser, logout } from '../lib/auth';

const navItems = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
    { to: '/admin/mahasiswa', label: 'Mahasiswa', icon: '👨‍🎓' },
    { to: '/admin/dosen', label: 'Dosen', icon: '👨‍🏫' },
    { to: '/admin/matkul', label: 'Mata Kuliah', icon: '📚' },
    { to: '/admin/jadwal', label: 'Jadwal', icon: '🗓️' },
    { to: '/admin/ajuan', label: 'Validasi Ajuan', icon: '✅' },
  ],
  asisten: [
    { to: '/asisten', label: 'Dashboard', icon: '📊', end: true },
    { to: '/asisten/sesi', label: 'Sesi Praktikum', icon: '🧪' },
    { to: '/asisten/absensi', label: 'Absensi & Scanner', icon: '📷' },
    { to: '/asisten/nilai', label: 'Input Nilai', icon: '📝' },
    { to: '/asisten/ajuan', label: 'Ajuan Jadwal', icon: '🔄' },
  ],
  dosen: [
    { to: '/dosen', label: 'Dashboard', icon: '📊', end: true },
    { to: '/dosen/nilai', label: 'Input Nilai', icon: '📝' },
    { to: '/dosen/rekap', label: 'Rekap Nilai', icon: '📋' },
    { to: '/dosen/materi', label: 'Upload Materi', icon: '📁' },
    { to: '/dosen/ajuan', label: 'Ajuan Jadwal', icon: '🔄' },
  ],
  praktikan: [
    { to: '/praktikan', label: 'Dashboard', icon: '📊', end: true },
    { to: '/praktikan/qr', label: 'QR Code Saya', icon: '📱' },
    { to: '/praktikan/jadwal', label: 'Jadwal', icon: '🗓️' },
    { to: '/praktikan/absensi', label: 'Absensi', icon: '✔️' },
    { to: '/praktikan/nilai', label: 'Nilai', icon: '🏆' },
  ],
};

const roleLabel = {
  admin: 'Administrator',
  asisten: 'Asisten',
  dosen: 'Dosen',
  praktikan: 'Praktikan',
};

export default function Sidebar() {
  const user = getUser();
  const role = user?.role?.namaRole || 'praktikan';
  const items = navItems[role] || [];
  const initials = user?.nama?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">MK Praktikum</div>
        <div className="sidebar-brand-sub">{roleLabel[role]}</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Menu</div>
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.nama || 'User'}
            </div>
            <div className="sidebar-user-role">{roleLabel[role]}</div>
          </div>
          <button
            onClick={logout}
            title="Keluar"
            style={{ color: 'var(--muted)', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >⏏</button>
        </div>
      </div>
    </aside>
  );
}
