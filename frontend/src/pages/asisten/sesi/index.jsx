import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './sesi.css';

const dayMap = {
  'Senin': 'Monday',
  'Selasa': 'Tuesday',
  'Rabu': 'Wednesday',
  'Kamis': 'Thursday',
  'Jumat': 'Friday',
  'Sabtu': 'Saturday',
  'Minggu': 'Sunday'
};

export default function AsistenSesi() {
  const [sesi, setSesi] = useState([]);
  const [jadwal, setJadwal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Selected pre-generated session to open
  const [selectedSesiId, setSelectedSesiId] = useState(null);
  const [topik, setTopik] = useState('');
 
  const fetchData = async () => {
    try {
      setLoading(true);
      const [sesiData, jadwalData] = await Promise.all([
        api.get('/asisten/sesi'),
        api.get('/asisten/jadwal')
      ]);
      setSesi(sesiData);
      setJadwal(jadwalData);
    } catch (err) {
      setError(err.message || 'Failed to fetch session data');
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchData();
  }, []);
 
  const handleOpenSesiClick = (s) => {
    setSelectedSesiId(s.id);
    setTopik(s.topik || `Pertemuan ke-${s.pertemuanKe}`);
    setIsModalOpen(true);
  };
 
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const data = await api.put(`/asisten/sesi/${selectedSesiId}/buka`, { topik });
      setSuccess('Practicum session opened successfully');
      setIsModalOpen(false);
      fetchData();
      
      // Auto redirect to absensi for the session
      setTimeout(() => {
        window.location.href = `/asisten/absensi?sesi=${data.data.id}`;
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to open session');
    }
  };
 
  const handleCloseSesi = async (id) => {
    if (!window.confirm('Are you sure you want to close this session? Once closed, attendance registration ends.')) return;
    
    try {
      setError('');
      setSuccess('');
      await api.put(`/asisten/sesi/${id}/tutup`);
      setSuccess('Practicum session closed successfully');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to close session');
    }
  };

  return (
    <DashboardLayout title="Practicum Sessions">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Practicum Session Meetings</h1>
          <p className="page-subtitle">Manage lab sessions, attendance scanner, and student materials</p>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      {loading ? (
        <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
          <div className="spinner" />
          <span className="text-muted text-mono">Loading session data...</span>
        </div>
      ) : sesi.length === 0 ? (
        <div className="empty-state">
          <p>No pre-generated sessions found. Please verify the semester schedule in the Admin panel first.</p>
        </div>
      ) : (
        <div className="sesi-grid">
          {sesi.map(s => {
            const isNotStarted = !s.dibukaPada && !s.ditutupPada;
            const isActive = s.dibukaPada && !s.ditutupPada;
            const isClosed = !!s.ditutupPada;
            const tgl = new Date(s.tanggal).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            
            let cardBorder = '1px solid var(--hairline)';
            if (isActive) cardBorder = '4px solid var(--success)';
            else if (isNotStarted) cardBorder = '2px solid rgba(255, 255, 255, 0.1)';

            return (
              <div className="sesi-card" key={s.id} style={{ borderLeft: cardBorder }}>
                <div>
                  <div className="flex-between mb-4">
                    <span className="badge badge-status-active" style={{ fontSize: '11px' }}>
                      Session #{s.pertemuanKe}
                    </span>
                    {isActive ? (
                      <span className="badge badge-status-active">Active / Open</span>
                    ) : isClosed ? (
                      <span className="badge badge-status-inactive">Completed / Closed</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>Not Started</span>
                    )}
                  </div>
                  
                  <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{s.jadwal?.mataKuliah?.nama}</h3>
                  <p className="text-mono" style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
                    {tgl} | Room: {s.jadwal?.ruangan?.nama || 'Lab'} | Day: {dayMap[s.jadwal?.hari] || s.jadwal?.hari}
                  </p>
                  
                  <p style={{ fontSize: '14px', color: 'var(--body)', minHeight: '44px' }}>
                    <strong>Topic:</strong> {s.topik || 'No specific topic'}
                  </p>
                </div>
                
                <div className="flex gap-2" style={{ marginTop: '20px', borderTop: '1px solid var(--hairline)', paddingTop: '12px' }}>
                  {isNotStarted && (
                    <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleOpenSesiClick(s)}>
                      Start Session
                    </button>
                  )}
                  {isActive && (
                    <>
                      <a href={`/asisten/absensi?sesi=${s.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                        Scanner
                      </a>
                      <button className="btn btn-danger btn-sm" onClick={() => handleCloseSesi(s.id)}>
                        Close
                      </button>
                    </>
                  )}
                  {isClosed && (
                    <a href={`/asisten/absensi?sesi=${s.id}`} className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                      View Attendance
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* modal open/start session */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Open Practicum Session</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div style={{ fontSize: '13px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.5 }}>
                Enter a topic to open the scanner for this session. The date of the session is locked based on your verified semester schedules.
              </div>

              <div className="form-group">
                <label className="form-label">Session Topic</label>
                <input 
                  type="text" 
                  name="topik" 
                  className="form-input" 
                  required
                  placeholder="Example: Introduction to HTML & CSS"
                  value={topik} 
                  onChange={(e) => setTopik(e.target.value)} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Start Session & Open Scanner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
