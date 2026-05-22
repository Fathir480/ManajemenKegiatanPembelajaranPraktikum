import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function DosenDashboard() {
  const user = getUser();
  const [matkul, setMatkul] = useState([]);

  useEffect(() => {
    api.get('/dosen/matkul').then(setMatkul).catch(() => {});
  }, []);

  return (
    <DashboardLayout title="Dashboard Dosen">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Dashboard Dosen</h1>
          <p className="page-subtitle">Kelola nilai, materi, dan jadwal mengajar Anda</p>
        </div>
      </div>

      <div className="grid-4 mb-8">
        <div className="stat-card">
          <div className="stat-icon blue">📚</div>
          <div>
            <div className="stat-label">Mata Kuliah</div>
            <div className="stat-value">{matkul.length}</div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Mata Kuliah yang Diampu</h3>
        </div>
        {matkul.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">📚</div><p>Belum ada mata kuliah yang diampu</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Kode</th><th>Nama</th><th>SKS</th><th>Tipe</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {matkul.map(mk => (
                  <tr key={mk.id}>
                    <td className="text-mono">{mk.kode}</td>
                    <td><strong>{mk.nama}</strong></td>
                    <td>{mk.sks}</td>
                    <td><span className="badge badge-dosen">{mk.tipe}</span></td>
                    <td style={{ display: 'flex', gap: '8px' }}>
                      <a href={`/dosen/rekap?mk=${mk.id}`} className="btn btn-outline btn-sm">Rekap Nilai</a>
                      <a href={`/dosen/materi?mk=${mk.id}`} className="btn btn-ghost btn-sm">Materi</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-3">
        {[
          { href: '/dosen/nilai', icon: '📝', label: 'Input Nilai UTS/UAS', desc: 'Masukkan nilai ujian mahasiswa' },
          { href: '/dosen/rekap', icon: '📋', label: 'Rekap Nilai', desc: 'Lihat nilai keseluruhan' },
          { href: '/dosen/materi', icon: '📁', label: 'Upload Materi', desc: 'Upload modul dan referensi' },
        ].map(item => (
          <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--hairline)', textDecoration: 'none', transition: 'all var(--transition)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--pacific-blue)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.transform = 'none'; }}>
            <span style={{ fontSize: '28px' }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>{item.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{item.desc}</div>
            </div>
          </a>
        ))}
      </div>
    </DashboardLayout>
  );
}
