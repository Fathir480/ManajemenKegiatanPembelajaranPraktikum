import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './jadwal.css';

const dayMap = {
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
          <p className="page-subtitle">List of active practicum classes you are registered in this semester</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      {loading ? (
        <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
      ) : jadwal.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>You are not registered in any practicum classes yet</p>
          </div>
        </div>
      ) : (
        <div className="jadwal-praktikan-grid">
          {jadwal.map(j => (
            <div className="card" key={j.id} style={{ borderLeft: '4px solid var(--hairline-strong)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="flex-between mb-4">
                  <span className="badge badge-status-active" style={{ fontSize: '11px' }}>
                    {j.mataKuliah?.kode}
                  </span>
                  <span className="badge badge-status-active">
                    {dayMap[j.hari] || j.hari}
                  </span>
                </div>

                <h3 style={{ fontSize: '18px', marginBottom: '8px', fontWeight: '500' }}>
                  {j.mataKuliah?.nama}
                </h3>
                
                <div style={{ fontSize: '13px', lineHeight: '1.8', color: 'var(--body)', marginTop: '12px' }}>
                  <div><strong>Session Time:</strong> {j.jamMulai} - {j.jamSelesai}</div>
                  <div><strong>Room:</strong> {j.ruangan?.nama || 'Lab'}</div>
                  <div><strong>Class Assistant:</strong> {j.asisten?.user?.nama || 'Not assigned yet'}</div>
                  <div className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
                    Semester: {j.semester}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
