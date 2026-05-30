import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './jadwal.css';

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
        setError('Gagal memuat jadwal praktikum Anda');
      } finally {
        setLoading(false);
      }
    };
    fetchJadwal();
  }, []);

  return (
    <DashboardLayout title="Jadwal Saya">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Jadwal Praktikum Anda</h1>
          <p className="page-subtitle">Daftar kelas praktikum aktif yang wajib Anda ikuti pada semester ini</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      {loading ? (
        <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
      ) : jadwal.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🗓️</div>
            <p>Anda belum terdaftar di kelas praktikum manapun</p>
          </div>
        </div>
      ) : (
        <div className="jadwal-praktikan-grid">
          {jadwal.map(j => (
            <div className="card" key={j.id} style={{ borderLeft: '4px solid var(--pacific-blue)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="flex-between mb-4">
                  <span className="badge badge-dosen" style={{ fontSize: '11px' }}>
                    {j.mataKuliah?.kode}
                  </span>
                  <span className="badge badge-hadir">
                    {j.hari}
                  </span>
                </div>

                <h3 style={{ fontSize: '18px', marginBottom: '8px', fontWeight: '500' }}>
                  {j.mataKuliah?.nama}
                </h3>
                
                <div style={{ fontSize: '13px', lineHeight: '1.8', color: 'var(--body)', marginTop: '12px' }}>
                  <div>⏱️ <strong>Jam Sesi:</strong> {j.jamMulai} - {j.jamSelesai}</div>
                  <div>📍 <strong>Ruangan:</strong> {j.ruangan?.nama || 'Lab'}</div>
                  <div>👨‍🏫 <strong>Asisten Kelas:</strong> {j.asisten?.user?.nama || 'Belum diplot'}</div>
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
