import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './ajuan.css';

const dayMap = {
  'Senin': 'Monday',
  'Selasa': 'Tuesday',
  'Rabu': 'Wednesday',
  'Kamis': 'Thursday',
  'Jumat': 'Friday',
  'Sabtu': 'Saturday',
  'Minggu': 'Sunday'
};

const statusMap = {
  'menunggu': 'Pending',
  'disetujui': 'Approved',
  'ditolak': 'Rejected'
};

export default function AsistenAjuan() {
  const [myJadwal, setMyJadwal] = useState([]);
  const [allJadwal, setAllJadwal] = useState([]);
  const [ajuan, setAjuan] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    jadwalAsalId: '',
    jadwalTujuanId: '',
    alasan: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [myJadwalData, allJadwalData, ajuanData] = await Promise.all([
        api.get('/asisten/jadwal'),
        api.get('/asisten/semua-jadwal'),
        api.get('/asisten/ajuan')
      ]);
      setMyJadwal(myJadwalData);
      setAllJadwal(allJadwalData);
      setAjuan(ajuanData);
    } catch (err) {
      setError(err.message || 'Failed to fetch request data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    if (myJadwal.length === 0) {
      setError('You are not assigned to any practicum schedule yet');
      return;
    }
    setFormData({
      jadwalAsalId: myJadwal[0]?.id || '',
      jadwalTujuanId: allJadwal[0]?.id || '',
      alasan: ''
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
    
    if (formData.jadwalAsalId === formData.jadwalTujuanId) {
      setError('Target schedule cannot be the same as the original schedule');
      return;
    }

    try {
      await api.post('/asisten/ajuan', formData);
      setSuccess('Schedule transfer request submitted successfully');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to submit request');
    }
  };

  return (
    <DashboardLayout title="Schedule Requests">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Request Schedule Change</h1>
          <p className="page-subtitle">Submit schedule change requests to be validated by the administrator</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          Request Transfer
        </button>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Your Request History</h3>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : ajuan.length === 0 ? (
          <div className="empty-state">
            <p>No request history yet</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Request Date</th>
                  <th>Original Schedule</th>
                  <th>Target Schedule</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ajuan.map(a => (
                  <tr key={a.id}>
                    <td className="text-mono" style={{ fontSize: '13px' }}>
                      {new Date(a.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    <td>
                      <strong>{a.jadwalAsal?.mataKuliah?.nama}</strong>
                      <br />
                      <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {dayMap[a.jadwalAsal?.hari] || a.jadwalAsal?.hari}, {a.jadwalAsal?.jamMulai} - {a.jadwalAsal?.jamSelesai}
                      </span>
                    </td>
                    <td>
                      <strong>{a.jadwalTujuan?.mataKuliah?.nama}</strong>
                      <br />
                      <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {dayMap[a.jadwalTujuan?.hari] || a.jadwalTujuan?.hari}, {a.jadwalTujuan?.jamMulai} - {a.jadwalTujuan?.jamSelesai}
                      </span>
                    </td>
                    <td>
                      <p style={{ fontSize: '13px', fontStyle: 'italic' }}>
                        "{a.alasan}"
                      </p>
                    </td>
                    <td>
                      <span className={`badge ${a.status === 'disetujui' ? 'badge-status-active' : 'badge-status-inactive'}`}>
                        {statusMap[a.status] || a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* modal add */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Request Schedule Change</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Select Your Original Class</label>
                <select 
                  name="jadwalAsalId" 
                  className="form-select" 
                  required
                  value={formData.jadwalAsalId} 
                  onChange={handleFormChange}
                >
                  {myJadwal.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.mataKuliah?.nama} ({dayMap[j.hari] || j.hari}, {j.jamMulai}-{j.jamSelesai})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Target Class / Schedule</label>
                <select 
                  name="jadwalTujuanId" 
                  className="form-select" 
                  required
                  value={formData.jadwalTujuanId} 
                  onChange={handleFormChange}
                >
                  {allJadwal.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.mataKuliah?.nama} ({dayMap[j.hari] || j.hari}, {j.jamMulai}-{j.jamSelesai}) - {j.ruangan?.nama || 'Lab'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Transfer</label>
                <textarea 
                  name="alasan" 
                  className="form-textarea" 
                  required
                  placeholder="Explain the reason for this schedule transfer request..."
                  value={formData.alasan} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
