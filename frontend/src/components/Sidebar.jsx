import { NavLink } from 'react-router-dom';
import { getUser, logout } from '../lib/auth';

const navItems = {
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/mahasiswa', label: 'Students' },
    { to: '/admin/asisten', label: 'Assistants' },
    { to: '/admin/dosen', label: 'Lecturers' },
    { to: '/admin/matkul', label: 'Courses' },
    { to: '/admin/kelas', label: 'Classes' },
    { to: '/admin/jadwal', label: 'Schedules' },
    { to: '/admin/ajuan', label: 'Requests' },
  ],
  asisten: [
    { to: '/asisten', label: 'Dashboard', end: true },
    { to: '/asisten/sesi', label: 'Practicum Sessions' },
    { to: '/asisten/absensi', label: 'Attendance & Scanner' },
    { to: '/asisten/nilai', label: 'Grade Input' },
    { to: '/asisten/ajuan', label: 'Schedule Requests' },
    { to: '/asisten/materi', label: 'Materials' },
  ],
  dosen: [
    { to: '/dosen', label: 'Dashboard', end: true },
    { to: '/dosen/nilai', label: 'Grade Input' },
    { to: '/dosen/rekap', label: 'Grade Recap' },
    { to: '/dosen/materi', label: 'Upload Material' },
    { to: '/dosen/ajuan', label: 'Schedule Requests' },
  ],
  praktikan: [
    { to: '/praktikan', label: 'Dashboard', end: true },
    { to: '/praktikan/qr', label: 'My QR Code' },
    { to: '/praktikan/kelas', label: 'Class Enrollment' },
    { to: '/praktikan/jadwal', label: 'Schedules' },
    { to: '/praktikan/absensi', label: 'Attendance' },
    { to: '/praktikan/nilai', label: 'Grades' },
    { to: '/praktikan/materi', label: 'Materials' },
  ],
};

const roleLabel = {
  admin: 'Administrator',
  asisten: 'Assistant',
  dosen: 'Lecturer',
  praktikan: 'Student',
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
            {item.icon && <span className="sidebar-link-icon">{item.icon}</span>}
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
            title="Logout"
            style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', transition: 'color var(--transition)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ff4d4d'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
