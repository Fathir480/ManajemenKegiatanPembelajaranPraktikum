import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './sesi.css';

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
      setError(err.message || 'Gagal mengambil data sesi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    if (jadwal.length === 0) {
      setError('Anda belum ditugaskan ke jadwal praktikum manapun');
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
      setSuccess('Sesi praktikum berhasil dibuka');
      setIsModalOpen(false);
      fetchData();
      
      // Auto redirect to absensi for the new session
      setTimeout(() => {
        window.location.href = `/asisten/absensi?sesi=${data.data.id}`;
      }, 1000);
    } catch (err) {
      setError(err.message || 'Gagal membuka sesi');
    }
  };

  const handleCloseSesi = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menutup sesi praktikum ini? Setelah ditutup, presensi selesai.')) return;
    
    try {
      setError('');
      setSuccess('');
      await api.put(`/asisten/sesi/${id}/tutup`);
      setSuccess('Sesi praktikum berhasil ditutup');
      fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menutup sesi');
    }
  };

  return (
    <DashboardLayout title="Sesi Praktikum">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Sesi Pertemuan Praktikum</h1>
          <p className="page-subtitle">Kelola pembukaan pertemuan lab, absensi scanner, dan rekap materi praktikan</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          🧪 Mulai Pertemuan Baru
        </button>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      {loading ? (
        <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
          <div className="spinner" />
          <span className="text-muted text-mono">Memuat data sesi...</span>
        </div>
      ) : sesi.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧪</div>
          <p>Belum ada sesi praktikum dibuka</p>
        </div>
      ) : (
        <div className="sesi-grid">
          {sesi.map(s => {
            const isActive = !s.ditutupPada;
            const tgl = new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div className="sesi-card" key={s.id} style={{ borderLeft: isActive ? '4px solid var(--success)' : '1px solid var(--hairline)' }}>
                <div>
                  <div className="flex-between mb-4">
                    <span className="badge badge-admin" style={{ fontSize: '11px' }}>
                      Pertemuan #{s.pertemuanKe}
                    </span>
                    <span className={`badge ${isActive ? 'badge-hadir' : 'badge-alpa'}`}>
                      {isActive ? 'Aktif / Terbuka' : 'Selesai / Ditutup'}
                    </span>
                  </div>
                  
                  <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{s.jadwal?.mataKuliah?.nama}</h3>
                  <p className="text-mono" style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
                    📅 {tgl} | 📍 {s.jadwal?.ruangan?.nama || 'Lab'}
                  </p>
                  
                  <p style={{ fontSize: '14px', color: 'var(--body)', minHeight: '44px' }}>
                    <strong>Topik:</strong> {s.topik || 'Tidak ada topik spesifik'}
                  </p>
                </div>
                
                <div className="flex gap-2" style={{ marginTop: '20px', borderTop: '1px solid var(--hairline)', paddingTop: '12px' }}>
                  <a href={`/asisten/absensi?sesi=${s.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    {isActive ? '📷 Scanner' : '📋 Lihat Absen'}
                  </a>
                  {isActive && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleCloseSesi(s.id)}>
                      🔒 Tutup
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
              <h3 className="modal-title">Mulai Pertemuan Baru</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Pilih Kelas / Jadwal Anda</label>
                <select 
                  name="jadwalId" 
                  className="form-select" 
                  required
                  value={formData.jadwalId} 
                  onChange={handleFormChange}
                >
                  <option value="" disabled>-- Pilih Kelas --</option>
                  {jadwal.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.mataKuliah?.nama} ({j.hari}, {j.jamMulai}-{j.jamSelesai})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tanggal Praktikum</label>
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
                  <label className="form-label">Pertemuan Ke-</label>
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
                <label className="form-label">Topik Pembahasan</label>
                <input 
                  type="text" 
                  name="topik" 
                  className="form-input" 
                  required
                  placeholder="Contoh: Pengenalan HTML & CSS"
                  value={formData.topik} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Buka Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
