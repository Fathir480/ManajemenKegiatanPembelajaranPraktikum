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

  // Form State
  const [formData, setFormData] = useState({
    jadwalId: '',
    tanggal: new Date().toISOString().split('T')[0],
    pertemuanKe: 1,
    topik: ''
  });

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

  const handleOpenAddModal = () => {
    if (jadwal.length === 0) {
      setError('You are not assigned to any schedule yet');
      return;
    }
    setFormData({
      jadwalId: jadwal[0]?.id || '',
      tanggal: new Date().toISOString().split('T')[0],
      pertemuanKe: 1,
      topik: ''
    });
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const data = await api.post('/asisten/sesi', formData);
      setSuccess('Practicum session opened successfully');
      setIsModalOpen(false);
      fetchData();
      
      // Auto redirect to absensi for the new session
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
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          Start New Session
        </button>
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
          <p>No practicum sessions opened yet</p>
        </div>
      ) : (
        <div className="sesi-grid">
          {sesi.map(s => {
            const isActive = !s.ditutupPada;
            const tgl = new Date(s.tanggal).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div className="sesi-card" key={s.id} style={{ borderLeft: isActive ? '4px solid var(--success)' : '1px solid var(--hairline)' }}>
                <div>
                  <div className="flex-between mb-4">
                    <span className="badge badge-status-active" style={{ fontSize: '11px' }}>
                      Session #{s.pertemuanKe}
                    </span>
                    <span className={`badge ${isActive ? 'badge-status-active' : 'badge-status-inactive'}`}>
                      {isActive ? 'Active / Open' : 'Completed / Closed'}
                    </span>
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
                  <a href={`/asisten/absensi?sesi=${s.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    {isActive ? 'Scanner' : 'View Attendance'}
                  </a>
                  {isActive && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleCloseSesi(s.id)}>
                      Close
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* modal add */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Start New Session</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Select Your Class / Schedule</label>
                <select 
                  name="jadwalId" 
                  className="form-select" 
                  required
                  value={formData.jadwalId} 
                  onChange={handleFormChange}
                >
                  <option value="" disabled>-- Select Class --</option>
                  {jadwal.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.mataKuliah?.nama} ({dayMap[j.hari] || j.hari}, {j.jamMulai}-{j.jamSelesai})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input 
                    type="date" 
                    name="tanggal" 
                    className="form-input" 
                    required 
                    value={formData.tanggal} 
                    onChange={handleFormChange} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Session Number</label>
                  <input 
                    type="number" 
                    name="pertemuanKe" 
                    className="form-input" 
                    required 
                    min="1" 
                    max="16"
                    value={formData.pertemuanKe} 
                    onChange={handleFormChange} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Topic</label>
                <input 
                  type="text" 
                  name="topik" 
                  className="form-input" 
                  required
                  placeholder="Example: Introduction to HTML & CSS"
                  value={formData.topik} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Open Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
