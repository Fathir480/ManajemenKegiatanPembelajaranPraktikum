import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './dosen.css';

export default function KelolaDosen() {
  const [dosen, setDosen] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    password: '',
    nid: '',
    spesialisasi: ''
  });

  const fetchDosen = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/dosen');
      setDosen(data);
    } catch (err) {
      setError(err.message || 'Gagal mengambil data dosen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDosen();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({
      nama: '',
      email: '',
      password: '',
      nid: '',
      spesialisasi: ''
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
      await api.post('/admin/dosen', formData);
      setSuccess('Dosen berhasil ditambahkan');
      setIsModalOpen(false);
      fetchDosen();
    } catch (err) {
      setError(err.message || 'Gagal menambahkan dosen');
    }
  };

  // --- BULK IMPORT EXCEL LOGIC ---
  const handleDownloadTemplate = () => {
    const headers = [['Nama', 'Email', 'NID', 'Spesialisasi']];
    const mockData = [
      ['Prof. Dr. Ir. H. Anwar', 'anwar@praktikum.ac.id', 'NID-002', 'Rekayasa Perangkat Lunak'],
      ['Siti Fatimah, S.T, M.T', 'fatimah@praktikum.ac.id', 'NID-003', 'Artificial Intelligence']
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...mockData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'Template_Impor_Dosen.xlsx');
  };

  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setError('');
        setSuccess('');
        setLoading(true);

        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          setError('Berkas Excel kosong atau format tidak sesuai');
          setLoading(false);
          return;
        }

        // Map keys to backend expected key names
        const items = rawData.map(r => ({
          nama: r['Nama'],
          email: r['Email'],
          nid: String(r['NID'] || ''),
          spesialisasi: r['Spesialisasi'] || ''
        }));

        const res = await api.post('/admin/dosen/bulk', { items });
        setSuccess(res.message);
        setIsBulkModalOpen(false);
        fetchDosen();
      } catch (err) {
        setError(err.message || 'Gagal memproses berkas Excel');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredDosen = dosen.filter(d => 
    d.user?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.nid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.spesialisasi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Kelola Dosen">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Manajemen Dosen</h1>
          <p className="page-subtitle">Kelola Nomor Induk Dosen (NID), spesialisasi mata kuliah, dan impor data massal</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
            📥 Impor Massal (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            ➕ Tambah Dosen
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="dosen-controls">
          <div className="search-wrapper">
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}>🔍</span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Cari nama, NID, spesialisasi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Menampilkan {filteredDosen.length} dosen
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Memproses data...</span>
          </div>
        ) : filteredDosen.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👨‍🏫</div>
            <p>Tidak ada dosen ditemukan</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>NID</th>
                  <th>Spesialisasi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDosen.map(d => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.user?.nama}</strong>
                      <br />
                      <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {d.user?.email}
                      </span>
                    </td>
                    <td className="text-mono">{d.nid}</td>
                    <td>{d.spesialisasi || '-'}</td>
                    <td>
                      <span className={`badge ${d.user?.aktif ? 'badge-hadir' : 'badge-alpa'}`}>
                        {d.user?.aktif ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* modal manual add */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Tambah Dosen</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input 
                  type="text" 
                  name="nama" 
                  className="form-input" 
                  required 
                  value={formData.nama} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  name="email" 
                  className="form-input" 
                  required 
                  value={formData.email} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  name="password" 
                  className="form-input" 
                  placeholder="Kosongkan jika ingin default: dosen123"
                  value={formData.password} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">NID (Nomor Induk Dosen)</label>
                <input 
                  type="text" 
                  name="nid" 
                  className="form-input" 
                  required 
                  value={formData.nid} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Spesialisasi</label>
                <input 
                  type="text" 
                  name="spesialisasi" 
                  className="form-input" 
                  placeholder="Contoh: Rekayasa Perangkat Lunak, Data Science" 
                  value={formData.spesialisasi} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* modal bulk upload */}
      {isBulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Impor Dosen Massal</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>×</button>
            </div>
            
            <div className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Unggah file Excel (.xlsx atau .xls) untuk mendaftarkan dosen secara massal dengan password default **`dosen123`**.
              </p>

              <button className="btn btn-outline" style={{ width: '100%', marginBottom: '24px', justifyContent: 'center' }} onClick={handleDownloadTemplate}>
                📥 Unduh Template Excel (.xlsx)
              </button>

              <div className="form-group" style={{ border: '2px dashed var(--hairline-strong)', padding: '24px', borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                <span style={{ fontSize: '32px' }}>📊</span>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginTop: '8px' }}>
                  Pilih Berkas Excel Template Anda
                </div>
                <div className="text-muted text-mono" style={{ fontSize: '11px', marginTop: '4px' }}>
                  Hanya mendukung format .xlsx and .xls
                </div>
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleBulkUpload}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsBulkModalOpen(false)}>
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
