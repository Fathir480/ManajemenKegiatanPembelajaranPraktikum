import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './jadwal.css';

const sessions = [
  { id: 1, name: 'Session 1', time: '07:00 - 09:30', jamMulai: '07:00', jamSelesai: '09:30' },
  { id: 2, name: 'Session 2', time: '09:40 - 12:10', jamMulai: '09:40', jamSelesai: '12:10' },
  { id: 3, name: 'Session 3', time: '13:00 - 15:30', jamMulai: '13:00', jamSelesai: '15:30' },
  { id: 4, name: 'Session 4', time: '15:40 - 18:10', jamMulai: '15:40', jamSelesai: '18:10' }
];

const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const dayIndoToEng = {
  'Senin': 'Monday',
  'Selasa': 'Tuesday',
  'Rabu': 'Wednesday',
  'Kamis': 'Thursday',
  'Jumat': 'Friday',
  'Sabtu': 'Saturday',
  'Minggu': 'Sunday'
};

export default function PraktikanJadwal() {
  const [jadwal, setJadwal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchJadwal = async () => {
      try {
        setLoading(true);
        const data = await api.get('/praktikan/jadwal');
        setJadwal(data);
      } catch (err) {
        setError('Failed to load your practicum schedule');
      } finally {
        setLoading(false);
      }
    };
    fetchJadwal();
  }, []);

  return (
    <DashboardLayout title="My Schedule">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Your Practicum Schedule</h1>
          <p className="page-subtitle">Matrix view of active practicum classes you are registered in</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      {loading ? (
        <div className="card flex-center" style={{ minHeight: '300px' }}><div className="spinner" /></div>
      ) : jadwal.length === 0 ? (
        <div className="card empty-state" style={{ padding: '60px 0' }}>
          <div className="empty-state-icon"></div>
          <p>You are not registered in any practicum classes yet</p>
        </div>
      ) : (
        <div className="matrix-grid-container jadwal-praktikan-view">
          <div className="table-wrapper matrix-wrapper custom-scrollbar-wrapper" style={{ overflowX: 'auto' }}>
            <table className="matrix-table" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '130px', minWidth: '130px', background: 'var(--surface-strong)', color: 'var(--ink)' }}>Time / Day</th>
                  {days.map(day => (
                    <th key={day} style={{ width: '220px', minWidth: '220px', textAlign: 'center', background: 'var(--surface-strong)', color: 'var(--ink)' }}>
                      {dayIndoToEng[day] || day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map(sesi => (
                  <tr key={sesi.id}>
                    <td className="matrix-sesi-cell">
                      <div className="matrix-sesi-time">{sesi.time}</div>
                    </td>
                    {days.map(day => {
                      // Find schedule matching day and session time
                      const cellSchedule = jadwal.find(j => 
                        j.hari === day &&
                        ((j.jamMulai === sesi.jamMulai) || (j.jamMulai >= sesi.jamMulai && j.jamMulai < sesi.jamSelesai))
                      );

                      const borderStyle = cellSchedule ? {
                        background: `rgba(255, 255, 255, 0.02)`,
                        textAlign: 'left'
                      } : null;

                      return (
                        <td key={day} className="matrix-slot-cell" style={{ verticalAlign: 'middle', padding: '8px' }}>
                          <div className="matrix-cards-container">
                            {cellSchedule ? (
                              <div className="matrix-card-compact" style={borderStyle}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                  <span className="text-mono" style={{ fontSize: '11px', color: 'var(--ink)', fontWeight: 'bold' }}>
                                    {cellSchedule.kelas?.namaKelas}
                                  </span>
                                </div>
                                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px', color: 'var(--ink)' }}>
                                  {cellSchedule.mataKuliah?.nama}
                                </strong>
                                <div className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                  </svg>
                                  {cellSchedule.ruangan?.nama || 'Lab'}
                                </div>
                              </div>
                            ) : (
                              <div style={{ height: '70px', border: '1px dashed var(--hairline)', borderRadius: '4px', opacity: 0.1 }}></div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
