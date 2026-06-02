import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './ajuan.css';

const dayIndoToEng = {
  'Senin': 'Monday',
  'Selasa': 'Tuesday',
  'Rabu': 'Wednesday',
  'Kamis': 'Thursday',
  'Jumat': 'Friday',
  'Sabtu': 'Saturday'
};

export default function ValidasiAjuan() {
  const [ajuanList, setAjuanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Validation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAjuan, setSelectedAjuan] = useState(null);
  const [validationStatus, setValidationStatus] = useState('disetujui'); // 'disetujui' | 'ditolak'
  const [catatanAdmin, setCatatanAdmin] = useState('');

  const fetchAjuan = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/ajuan');
      setAjuanList(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch requests data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAjuan();
  }, []);

  const handleOpenValidationModal = (ajuan, status) => {
    setSelectedAjuan(ajuan);
    setValidationStatus(status);
    setCatatanAdmin('');
    setIsModalOpen(true);
  };

  const handleValidationSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      await api.put(`/admin/ajuan/${selectedAjuan.id}/validasi`, {
        status: validationStatus,
        catatanAdmin
      });
      setSuccess(`Request successfully ${validationStatus === 'disetujui' ? 'approved' : 'rejected'}`);
      setIsModalOpen(false);
      fetchAjuan();
    } catch (err) {
      setError(err.message || 'Failed to process validation');
    }
  };

  return (
    <DashboardLayout title="Request Validation">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Schedule Change Validation</h1>
          <p className="page-subtitle">Review, approve, or reject requests for practicum session changes</p>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Loading requests...</span>
          </div>
        ) : ajuanList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No schedule change requests found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Requester</th>
                  <th>Original Schedule</th>
                  <th>Target Schedule</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {ajuanList.map(a => {
                  const roleName = a.pengaju?.role?.namaRole === 'admin' ? 'Admin' :
                                   a.pengaju?.role?.namaRole === 'dosen' ? 'Lecturer' :
                                   a.pengaju?.role?.namaRole === 'asisten' ? 'Assistant' :
                                   a.pengaju?.role?.namaRole === 'mahasiswa' ? 'Student' :
                                   a.pengaju?.role?.namaRole;

                  return (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.pengaju?.nama}</strong>
                        <br />
                        <span className="badge badge-admin" style={{ fontSize: '10px', marginTop: '4px', textTransform: 'capitalize' }}>
                          {roleName}
                        </span>
                      </td>
                      <td>
                        <strong>{a.jadwalAsal?.mataKuliah?.nama}</strong>
                        <br />
                        <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {dayIndoToEng[a.jadwalAsal?.hari] || a.jadwalAsal?.hari}, {a.jadwalAsal?.jamMulai} - {a.jadwalAsal?.jamSelesai}
                        </span>
                      </td>
                      <td>
                        <strong>{a.jadwalTujuan?.mataKuliah?.nama}</strong>
                        <br />
                        <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {dayIndoToEng[a.jadwalTujuan?.hari] || a.jadwalTujuan?.hari}, {a.jadwalTujuan?.jamMulai} - {a.jadwalTujuan?.jamSelesai}
                        </span>
                      </td>
                      <td>
                        <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--body)' }}>
                          "{a.alasan}"
                        </p>
                        {a.catatanAdmin && (
                          <div className="catatan-box">
                            <strong>Admin Notes:</strong> {a.catatanAdmin}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${a.status}`} style={{ textTransform: 'capitalize' }}>
                          {a.status === 'menunggu' ? 'Pending' : a.status === 'disetujui' ? 'Approved' : 'Rejected'}
                        </span>
                      </td>
                      <td>
                        {a.status === 'menunggu' ? (
                          <div className="flex gap-2">
                            <button 
                              className="btn btn-primary btn-sm" 
                              onClick={() => handleOpenValidationModal(a, 'disetujui')}
                            >
                              Approve
                            </button>
                            <button 
                              className="btn btn-danger btn-sm" 
                              onClick={() => handleOpenValidationModal(a, 'ditolak')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '12px' }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* modal validation */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {validationStatus === 'disetujui' ? 'Approve Request' : 'Reject Request'}
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleValidationSubmit} className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '12px' }}>
                You are about to {validationStatus === 'disetujui' ? 'approve' : 'reject'} the schedule change request from{' '}
                <strong>{selectedAjuan?.pengaju?.nama}</strong> for{' '}
                <strong>{selectedAjuan?.jadwalAsal?.mataKuliah?.nama}</strong>.
              </p>

              <div className="form-group">
                <label className="form-label">Admin Notes (Optional)</label>
                <textarea 
                  name="catatanAdmin" 
                  className="form-textarea" 
                  placeholder="Add instructions, reason for rejection, or other messages..."
                  value={catatanAdmin} 
                  onChange={(e) => setCatatanAdmin(e.target.value)} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`btn ${validationStatus === 'disetujui' ? 'btn-primary' : 'btn-danger'}`}
                >
                  Confirm {validationStatus === 'disetujui' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
