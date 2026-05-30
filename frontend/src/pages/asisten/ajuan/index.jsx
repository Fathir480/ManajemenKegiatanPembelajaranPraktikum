import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './ajuan.css';

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
      setError(err.message || 'Gagal mengambil data ajuan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    if (myJadwal.length === 0) {
      setError('Anda belum ditugaskan ke jadwal praktikum manapun');
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
      setError('Jadwal tujuan tidak boleh sama dengan jadwal asal');
      return;
    }

    try {
      await api.post('/asisten/ajuan', formData);
      setSuccess('Ajuan pemindahan jadwal berhasil diajukan');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Gagal mengirim pengajuan');
    }
  };

  return (
    <DashboardLayout title="Pengajuan Jadwal">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Pengajuan Pindah Jadwal</h1>
          <p className="page-subtitle">Ajukan perpindahan jadwal praktikum Anda ke jadwal lain untuk divalidasi oleh admin</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          🔄 Ajukan Pemindahan
        </button>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Riwayat Pengajuan Anda</h3>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : ajuan.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔄</div>
            <p>Belum ada riwayat pengajuan</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tanggal Pengajuan</th>
                  <th>Jadwal Asal</th>
                  <th>Jadwal Tujuan</th>
                  <th>Alasan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ajuan.map(a => (
                  <tr key={a.id}>
                    <td className="text-mono" style={{ fontSize: '13px' }}>
                      {new Date(a.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                      <p style={{ fontSize: '13px', fontStyle: 'italic' }}>
                        "{a.alasan}"
                      </p>
                    </td>
                    <td>
                      <span className={`badge badge-${a.status}`}>
                        {a.status}
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
              <h3 className="modal-title">Ajukan Pindah Jadwal</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Pilih Kelas Asal Anda</label>
                <select 
                  name="jadwalAsalId" 
                  className="form-select" 
                  required
                  value={formData.jadwalAsalId} 
                  onChange={handleFormChange}
                >
                  {myJadwal.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.mataKuliah?.nama} ({j.hari}, {j.jamMulai}-{j.jamSelesai})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Pilih Kelas / Jadwal Tujuan</label>
                <select 
                  name="jadwalTujuanId" 
                  className="form-select" 
                  required
                  value={formData.jadwalTujuanId} 
                  onChange={handleFormChange}
                >
                  {allJadwal.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.mataKuliah?.nama} ({j.hari}, {j.jamMulai}-{j.jamSelesai}) - {j.ruangan?.nama || 'Lab'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Alasan Pemindahan</label>
                <textarea 
                  name="alasan" 
                  className="form-textarea" 
                  required
                  placeholder="Jelaskan alasan pengajuan perpindahan jadwal kelas praktikum ini..."
                  value={formData.alasan} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Kirim Ajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
