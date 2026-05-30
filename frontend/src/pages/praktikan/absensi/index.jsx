import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './absensi.css';

export default function PraktikanAbsensi() {
  const [absensi, setAbsensi] = useState({ detail: [], rekap: { hadir: 0, izin: 0, sakit: 0, alpa: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAbsensi = async () => {
      try {
        setLoading(true);
        const data = await api.get('/praktikan/absensi');
        setAbsensi(data);
      } catch (err) {
        setError('Gagal memuat rekap absensi Anda');
      } finally {
        setLoading(false);
      }
    };
    fetchAbsensi();
  }, []);

  const rekap = absensi.rekap;
  const total = Object.values(rekap).reduce((a, b) => a + b, 0);
  const persenKehadiran = total > 0 ? Math.round((rekap.hadir / total) * 100) : 0;

  return (
    <DashboardLayout title="Riwayat Kehadiran">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Rekapitulasi Absensi</h1>
          <p className="page-subtitle">Rincian absensi kehadiran praktikum Anda di setiap pertemuan sesi lab</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      {loading ? (
        <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
      ) : (
        <div>
          {/* Rekap Cards */}
          <div className="absensi-rekap-panel">
            {[
              { label: 'Hadir', val: rekap.hadir, cls: 'badge-hadir', icon: '✅' },
              { label: 'Izin', val: rekap.izin, cls: 'badge-izin', icon: '📋' },
              { label: 'Sakit', val: rekap.sakit, cls: 'badge-sakit', icon: '🏥' },
              { label: 'Alpa', val: rekap.alpa, cls: 'badge-alpa', icon: '❌' },
            ].map(item => (
              <div className="card" key={item.label} style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{item.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: '300', color: 'var(--ink)' }}>
                  {item.val}
                </div>
                <span className={`badge ${item.cls}`} style={{ marginTop: '8px', fontSize: '12px' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Kehadiran Card Percentage */}
          <div className="card mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '500' }}>Tingkat Kehadiran Kumulatif</h3>
              <p style={{ fontSize: '14px', color: 'var(--body)' }}>Persentase kehadiran Anda pada seluruh praktikum semester ini</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="text-mono" style={{ fontSize: '36px', fontWeight: '600', color: 'var(--pacific-blue-dark)' }}>
                {persenKehadiran}%
              </span>
              <span className={`badge ${persenKehadiran >= 80 ? 'badge-hadir' : 'badge-alpa'}`} style={{ padding: '4px 12px' }}>
                {persenKehadiran >= 80 ? 'Memenuhi Syarat' : 'Kurang / Terancam Sanksi'}
              </span>
            </div>
          </div>

          {/* Riwayat Absensi Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Riwayat Log Sesi</h3>
            </div>
            {absensi.detail.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✔️</div>
                <p>Belum ada riwayat pencatatan absensi sesi praktikum</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Mata Kuliah / Sesi</th>
                      <th>Pertemuan</th>
                      <th>Tanggal</th>
                      <th>Topik Sesi</th>
                      <th>Metode Pencatatan</th>
                      <th>Status Presensi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absensi.detail.map(a => {
                      const tgl = new Date(a.sesi?.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                      return (
                        <tr key={a.id}>
                          <td><strong>{a.sesi?.jadwal?.mataKuliah?.nama}</strong></td>
                          <td className="text-mono"># {a.sesi?.pertemuanKe}</td>
                          <td className="text-mono" style={{ fontSize: '13px' }}>{tgl}</td>
                          <td>{a.sesi?.topik || '-'}</td>
                          <td>
                            <span className="badge badge-admin" style={{ textTransform: 'capitalize' }}>
                              {a.metode === 'qr_scan' ? '📱 QR Code Scanner' : '✍️ Input Manual'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${a.status}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
