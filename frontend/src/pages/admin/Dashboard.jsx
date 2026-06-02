import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function AdminDashboard() {
  const user = getUser();
  const [stats, setStats] = useState({ mahasiswa: 0, dosen: 0, matkul: 0, ajuan: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [mhs, dsn, mk, aj] = await Promise.all([
          api.get('/admin/mahasiswa'),
          api.get('/admin/dosen'),
          api.get('/admin/matkul'),
          api.get('/admin/ajuan'),
        ]);
        setStats({
          mahasiswa: mhs.length,
          dosen: dsn.length,
          matkul: mk.length,
          ajuan: aj.filter(a => a.status === 'menunggu').length,
        });
      } catch (e) { /* silent */ }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Students', value: stats.mahasiswa },
    { label: 'Total Lecturers', value: stats.dosen },
    { label: 'Active Courses', value: stats.matkul },
    { label: 'Pending Requests', value: stats.ajuan },
  ];

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Welcome Back, {user?.nama?.split(' ')[0]}</h1>
          <p className="page-subtitle">Integrated Academic Management System</p>
        </div>
      </div>

      <div className="grid-4 mb-8">
        {statCards.map(card => (
          <div className="stat-card" key={card.label}>
            <div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Quick Access</h3>
        </div>
        <div className="grid-3" style={{ gap: '16px' }}>
          {[
            { href: '/admin/mahasiswa', label: 'Manage Students', desc: 'Student directories & records' },
            { href: '/admin/dosen', label: 'Manage Lecturers', desc: 'Lecturer directories & NIDs' },
            { href: '/admin/jadwal', label: 'Manage Schedules', desc: 'Practical slots & session times' },
            { href: '/admin/matkul', label: 'Course Management', desc: 'Curriculum structures' },
            { href: '/admin/ajuan', label: 'Validate Requests', desc: `${stats.ajuan} waiting for review` },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="card quick-access-card"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 24px', textDecoration: 'none',
                transition: 'all var(--transition)',
                background: 'var(--surface-soft)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hairline)'}
            >
              <div style={{ flex: 1 }}>
                <div className="quick-access-label">{item.label}</div>
                <div className="quick-access-desc">{item.desc}</div>
              </div>
              <span className="quick-access-arrow">→</span>
            </a>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
