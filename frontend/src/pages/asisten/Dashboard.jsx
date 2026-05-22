import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

export default function AsistenDashboard() {
  const user = getUser();
  const [jadwal, setJadwal] = useState([]);

  useEffect(() => {
    api.get('/asisten/jadwal').then(setJadwal).catch(() => {});
  }, []);

  const hariIni = new Date().toLocaleDateString('id-ID', { weekday: 'long' });

  return (
    <DashboardLayout title="Dashboard Asisten">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Dashboard Asisten</h1>
          <p className="page-subtitle">Hari ini: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid-4 mb-8">
        {[
          { label: 'Kelas Diampu', value: jadwal.length, icon: '🧪', color: 'blue' },
          { label: 'Jadwal Hari Ini', value: jadwal.filter(j => j.hari === hariIni).length, icon: '📅', color: 'green' },
        ].map(card => (
          <div className="stat-card" key={card.label}>
            <div className={`stat-icon ${card.color}`}>{card.icon}</div>
            <div>
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Kelas yang Diampu</h3>
          <a href="/asisten/absensi" className="btn btn-primary btn-sm">📷 Buka Scanner</a>
        </div>
        {jadwal.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">🧪</div><p>Belum ada kelas yang ditugaskan</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mata Kuliah</th>
                  <th>Hari</th>
                  <th>Jam</th>
                  <th>Ruangan</th>
                  <th>Peserta</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jadwal.map(j => (
                  <tr key={j.id}>
                    <td><strong>{j.mataKuliah?.nama}</strong><br /><span className="text-mono" style={{ color: 'var(--muted)' }}>{j.mataKuliah?.kode}</span></td>
                    <td><span className={`badge badge-${j.hari === hariIni ? 'hadir' : 'izin'}`}>{j.hari}</span></td>
                    <td className="text-mono">{j.jamMulai} – {j.jamSelesai}</td>
                    <td>{j.ruangan?.nama || '-'}</td>
                    <td>{j.pesertaJadwal?.length || 0} mhs</td>
                    <td>
                      <a href="/asisten/sesi" className="btn btn-outline btn-sm">Buka Sesi</a>
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
          { href: '/asisten/sesi', icon: '🧪', label: 'Buka Sesi Baru', desc: 'Mulai pertemuan praktikum' },
          { href: '/asisten/absensi', icon: '📷', label: 'Scan QR Absensi', desc: 'Rekam kehadiran mahasiswa' },
          { href: '/asisten/nilai', icon: '📝', label: 'Input Nilai', desc: 'Catat nilai asistensi & laporan' },
        ].map(item => (
          <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--hairline)', textDecoration: 'none', transition: 'all var(--transition)', background: 'var(--surface)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--pacific-blue)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
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
