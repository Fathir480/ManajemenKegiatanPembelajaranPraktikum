import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './absensi.css';

const statusMap = {
  'hadir': 'Present',
  'izin': 'Excused',
  'sakit': 'Sick',
  'alpa': 'Absent'
};

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
        setError('Failed to load your attendance recap');
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
    <DashboardLayout title="Attendance History">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Attendance Recap</h1>
          <p className="page-subtitle">Details of your practicum attendance in each lab session</p>
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
              { label: 'Present', val: rekap.hadir, cls: 'badge-status-active' },
              { label: 'Excused', val: rekap.izin, cls: 'badge-status-inactive' },
              { label: 'Sick', val: rekap.sakit, cls: 'badge-status-inactive' },
              { label: 'Absent', val: rekap.alpa, cls: 'badge-status-inactive' },
            ].map(item => (
              <div className="card" key={item.label} style={{ textAlign: 'center', padding: '24px' }}>
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
              <h3 style={{ fontSize: '18px', fontWeight: '500' }}>Cumulative Attendance Rate</h3>
              <p style={{ fontSize: '14px', color: 'var(--body)' }}>Your attendance percentage across all practicum sessions this semester</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="text-mono" style={{ fontSize: '36px', fontWeight: '600', color: 'var(--pacific-blue-dark)' }}>
                {persenKehadiran}%
              </span>
              <span className={`badge ${persenKehadiran >= 80 ? 'badge-status-active' : 'badge-status-inactive'}`} style={{ padding: '4px 12px' }}>
                {persenKehadiran >= 80 ? 'Eligible' : 'Below Requirement / Warning'}
              </span>
            </div>
          </div>

          {/* Riwayat Absensi Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Session Log History</h3>
            </div>
            {absensi.detail.length === 0 ? (
              <div className="empty-state">
                <p>No attendance history recorded yet</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Course / Session</th>
                      <th>Session</th>
                      <th>Date</th>
                      <th>Session Topic</th>
                      <th>Recording Method</th>
                      <th>Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absensi.detail.map(a => {
                      const tgl = new Date(a.sesi?.tanggal).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                      return (
                        <tr key={a.id}>
                          <td><strong>{a.sesi?.jadwal?.mataKuliah?.nama}</strong></td>
                          <td className="text-mono"># {a.sesi?.pertemuanKe}</td>
                          <td className="text-mono" style={{ fontSize: '13px' }}>{tgl}</td>
                          <td>{a.sesi?.topik || '-'}</td>
                          <td>
                            <span className="badge badge-status-active">
                              {a.metode === 'qr_scan' ? 'QR Code Scan' : 'Manual Input'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${a.status === 'hadir' ? 'badge-status-active' : 'badge-status-inactive'}`}>
                              {statusMap[a.status] || a.status}
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
