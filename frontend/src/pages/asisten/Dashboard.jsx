import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

const dayMap = {
  'Senin': 'Monday',
  'Selasa': 'Tuesday',
  'Rabu': 'Wednesday',
  'Kamis': 'Thursday',
  'Jumat': 'Friday',
  'Sabtu': 'Saturday',
  'Minggu': 'Sunday'
};

export default function AsistenDashboard() {
  const user = getUser();
  const [jadwal, setJadwal] = useState([]);

  useEffect(() => {
    api.get('/asisten/jadwal').then(setJadwal).catch(() => {});
  }, []);

  const hariIniIndo = new Date().toLocaleDateString('id-ID', { weekday: 'long' });
  const formattedToday = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <DashboardLayout title="Assistant Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Assistant Dashboard</h1>
          <p className="page-subtitle">Today: {formattedToday}</p>
        </div>
      </div>

      <div className="grid-4 mb-8">
        {[
          { label: 'Assigned Classes', value: jadwal.length, color: 'blue' },
          { label: "Today's Schedule", value: jadwal.filter(j => j.hari === hariIniIndo).length, color: 'green' },
        ].map(card => (
          <div className="stat-card" key={card.label}>
            <div>
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Assigned Classes</h3>
          <a href="/asisten/absensi" className="btn btn-primary btn-sm">Manage Attendance</a>
        </div>
        {jadwal.length === 0 ? (
          <div className="empty-state"><p>No classes assigned yet</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Room</th>
                  <th>Students</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {jadwal.map(j => (
                  <tr key={j.id}>
                    <td><strong>{j.mataKuliah?.nama}</strong><br /><span className="text-mono" style={{ color: 'var(--muted)' }}>{j.mataKuliah?.kode}</span></td>
                    <td>
                      <span className={`badge ${j.hari === hariIniIndo ? 'badge-status-active' : 'badge-status-inactive'}`}>
                        {dayMap[j.hari] || j.hari}
                      </span>
                    </td>
                    <td className="text-mono">{j.jamMulai} – {j.jamSelesai}</td>
                    <td>{j.ruangan?.nama || '-'}</td>
                    <td>{j.pesertaJadwal?.length || 0} students</td>
                    <td>
                      <a href="/asisten/absensi" className="btn btn-outline btn-sm">Attendance</a>
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
          { href: '/asisten/absensi', label: 'Attendance & Scanner', desc: 'Record and monitor student attendance' },
          { href: '/asisten/nilai', label: 'Grade Input', desc: 'Record assistant & report grades' },
          { href: '/asisten/materi', label: 'Materi & Modul', desc: 'Manage practicum materials' },
        ].map(item => (
          <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--hairline)', textDecoration: 'none', transition: 'all var(--transition)', background: 'var(--surface)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ffffff'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
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
