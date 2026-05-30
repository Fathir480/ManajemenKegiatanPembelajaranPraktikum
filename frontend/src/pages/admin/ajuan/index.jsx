import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './ajuan.css';

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
      setError(err.message || 'Gagal mengambil data ajuan');
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
      setSuccess(`Ajuan berhasil ${validationStatus === 'disetujui' ? 'disetujui' : 'ditolak'}`);
      setIsModalOpen(false);
      fetchAjuan();
    } catch (err) {
      setError(err.message || 'Gagal memproses validasi');
    }
  };

  return (
    <DashboardLayout title="Validasi Ajuan">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Validasi Ajuan Pindah Jadwal</h1>
          <p className="page-subtitle">Tinjau, setujui, atau tolak permohonan perpindahan sesi praktikum</p>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Memuat ajuan...</span>
          </div>
        ) : ajuanList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p>Tidak ada pengajuan perpindahan jadwal</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pengaju</th>
                  <th>Jadwal Asal</th>
                  <th>Jadwal Tujuan</th>
                  <th>Alasan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {ajuanList.map(a => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.pengaju?.nama}</strong>
                      <br />
                      <span className="badge badge-admin" style={{ fontSize: '10px', marginTop: '4px' }}>
                        {a.pengaju?.role?.namaRole}
                      </span>
                    </td>
                    <td>
                      <strong>{a.jadwalAsal?.mataKuliah?.nama}</strong>
                      <br />
                      <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {a.jadwalAsal?.hari}, {a.jadwalAsal?.jamMulai} - {a.jadwalAsal?.jamSelesai}
                      </span>
                    </td>
                    <td>
                      <strong>{a.jadwalTujuan?.mataKuliah?.nama}</strong>
                      <br />
                      <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {a.jadwalTujuan?.hari}, {a.jadwalTujuan?.jamMulai} - {a.jadwalTujuan?.jamSelesai}
                      </span>
                    </td>
                    <td>
                      <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--body)' }}>
                        "{a.alasan}"
                      </p>
                      {a.catatanAdmin && (
                        <div className="catatan-box">
                          <strong>Catatan Admin:</strong> {a.catatanAdmin}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${a.status}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      {a.status === 'menunggu' ? (
                        <div className="flex gap-2">
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={() => handleOpenValidationModal(a, 'disetujui')}
                          >
                            ✔️ Setujui
                          </button>
                          <button 
                            className="btn btn-danger btn-sm" 
                            onClick={() => handleOpenValidationModal(a, 'ditolak')}
                          >
                            ❌ Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '12px' }}>Diproses</span>
                      )}
                    </td>
                  </tr>
                ))}
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
                {validationStatus === 'disetujui' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleValidationSubmit} className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '12px' }}>
                Anda akan {validationStatus === 'disetujui' ? 'menyetujui' : 'menolak'} pengajuan dari{' '}
                <strong>{selectedAjuan?.pengaju?.nama}</strong> untuk pemindahan kelas{' '}
                <strong>{selectedAjuan?.jadwalAsal?.mataKuliah?.nama}</strong>.
              </p>

              <div className="form-group">
                <label className="form-label">Catatan Admin (Opsional)</label>
                <textarea 
                  name="catatanAdmin" 
                  className="form-textarea" 
                  placeholder="Tambahkan instruksi, alasan penolakan, atau pesan lainnya..."
                  value={catatanAdmin} 
                  onChange={(e) => setCatatanAdmin(e.target.value)} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </button>
                <button 
                  type="submit" 
                  className={`btn ${validationStatus === 'disetujui' ? 'btn-primary' : 'btn-danger'}`}
                >
                  Konfirmasi {validationStatus === 'disetujui' ? 'Setujui' : 'Tolak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
