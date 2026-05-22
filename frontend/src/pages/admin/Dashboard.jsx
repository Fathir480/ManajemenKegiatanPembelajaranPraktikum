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
    { label: 'Total Mahasiswa', value: stats.mahasiswa, icon: '👨‍🎓', color: 'blue' },
    { label: 'Total Dosen', value: stats.dosen, icon: '👨‍🏫', color: 'green' },
    { label: 'Mata Kuliah Aktif', value: stats.matkul, icon: '📚', color: 'yellow' },
    { label: 'Ajuan Menunggu', value: stats.ajuan, icon: '🔔', color: 'orange' },
  ];

  return (
    <DashboardLayout title="Dashboard Admin">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Selamat Datang, {user?.nama?.split(' ')[0]}</h1>
          <p className="page-subtitle">Ringkasan sistem manajemen kegiatan praktikum</p>
        </div>
      </div>

      <div className="grid-4 mb-8">
        {statCards.map(card => (
          <div className="stat-card" key={card.label}>
            <div className={`stat-icon ${card.color}`}>{card.icon}</div>
            <div>
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Akses Cepat</h3>
        </div>
        <div className="grid-3" style={{ gap: '12px' }}>
          {[
            { href: '/admin/mahasiswa', icon: '👨‍🎓', label: 'Kelola Mahasiswa', desc: 'CRUD data & stambuk' },
            { href: '/admin/dosen', icon: '👨‍🏫', label: 'Kelola Dosen', desc: 'CRUD data & NID' },
            { href: '/admin/jadwal', icon: '🗓️', label: 'Kelola Jadwal', desc: 'Atur jadwal praktikum' },
            { href: '/admin/matkul', icon: '📚', label: 'Mata Kuliah', desc: 'Manajemen matkul' },
            { href: '/admin/ajuan', icon: '✅', label: 'Validasi Ajuan', desc: `${stats.ajuan} menunggu persetujuan` },
          ].map(item => (
            <a key={item.href} href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '16px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--hairline)', textDecoration: 'none',
                transition: 'all var(--transition)',
                background: 'var(--surface-soft)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--pacific-blue)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hairline)'}
            >
              <span style={{ fontSize: '24px' }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--ink)' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{item.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
