import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './matkul.css';

export default function KelolaMatkul() {
  const [matkul, setMatkul] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedMatkul, setSelectedMatkul] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    kode: '',
    nama: '',
    sks: 2,
    tipe: 'praktikum', // 'kuliah' | 'praktikum' | 'keduanya'
    deskripsi: '',
    aktif: true
  });

  const fetchMatkul = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/matkul');
      setMatkul(data);
    } catch (err) {
      setError(err.message || 'Gagal mengambil data mata kuliah');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatkul();
  }, []);

  // --- BULK IMPORT EXCEL LOGIC ---
  const handleDownloadTemplate = () => {
    const headers = [['Kode', 'Nama', 'SKS', 'Tipe', 'Deskripsi']];
    const mockData = [
      ['IF101', 'Algoritma & Pemrograman', 3, 'keduanya', 'Dasar pemrograman komputer'],
      ['IF102', 'Sistem Operasi', 2, 'praktikum', 'Pengenalan konsep sistem operasi modern']
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...mockData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'Template_Impor_MataKuliah.xlsx');
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
          kode: String(r['Kode'] || ''),
          nama: r['Nama'],
          sks: parseInt(r['SKS'] || '2'),
          tipe: r['Tipe'] || 'praktikum',
          deskripsi: r['Deskripsi'] || ''
        }));

        const res = await api.post('/admin/matkul/bulk', { items });
        setSuccess(res.message);
        setIsBulkModalOpen(false);
        fetchMatkul();
      } catch (err) {
        setError(err.message || 'Gagal memproses berkas Excel');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      kode: '',
      nama: '',
      sks: 2,
      tipe: 'praktikum',
      deskripsi: '',
      aktif: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mk) => {
    setModalMode('edit');
    setSelectedMatkul(mk);
    setFormData({
      kode: mk.kode || '',
      nama: mk.nama || '',
      sks: mk.sks || 2,
      tipe: mk.tipe || 'praktikum',
      deskripsi: mk.deskripsi || '',
      aktif: mk.aktif !== undefined ? mk.aktif : true
    });
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      if (modalMode === 'add') {
        await api.post('/admin/matkul', formData);
        setSuccess('Mata kuliah berhasil ditambahkan');
      } else {
        await api.put(`/admin/matkul/${selectedMatkul.id}`, formData);
        setSuccess('Mata kuliah berhasil diperbarui');
      }
      setIsModalOpen(false);
      fetchMatkul();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan data');
    }
  };

  const filteredMatkul = matkul.filter(m => 
    m.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.kode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Mata Kuliah">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Manajemen Mata Kuliah</h1>
          <p className="page-subtitle">Kelola kurikulum praktikum, SKS, dan komponen penilaian kelas</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
            📥 Impor Massal (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            ➕ Tambah Matkul
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="matkul-controls">
          <div className="search-wrapper">
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}>🔍</span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Cari kode atau nama matkul..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Menampilkan {filteredMatkul.length} mata kuliah
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Memuat data...</span>
          </div>
        ) : filteredMatkul.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <p>Tidak ada mata kuliah ditemukan</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Mata Kuliah</th>
                  <th>SKS</th>
                  <th>Tipe</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatkul.map(m => (
                  <tr key={m.id}>
                    <td className="text-mono">{m.kode}</td>
                    <td>
                      <strong>{m.nama}</strong>
                      <br />
                      <span className="text-muted" style={{ fontSize: '12px' }}>
                        {m.deskripsi || 'Tidak ada deskripsi'}
                      </span>
                    </td>
                    <td>{m.sks} SKS</td>
                    <td>
                      <span className="badge badge-dosen">
                        {m.tipe}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${m.aktif ? 'badge-hadir' : 'badge-alpa'}`}>
                        {m.aktif ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpenEditModal(m)}>
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* modal bulk upload */}
      {isBulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Impor Mata Kuliah Massal</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>×</button>
            </div>
            
            <div className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Unggah file Excel (.xlsx atau .xls) untuk mendaftarkan mata kuliah secara massal. Kolom 'Tipe' bernilai 'kuliah', 'praktikum', atau 'keduanya'.
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
                  Hanya mendukung format .xlsx dan .xls
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

      {/* modal add/edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'add' ? 'Tambah Mata Kuliah' : 'Edit Mata Kuliah'}
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Kode Mata Kuliah</label>
                <input 
                  type="text" 
                  name="kode" 
                  className="form-input" 
                  required 
                  disabled={modalMode === 'edit'} // Kode tidak bisa diedit setelah dibuat
                  value={formData.kode} 
                  onChange={handleFormChange} 
                  placeholder="Contoh: IF123"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Mata Kuliah</label>
                <input 
                  type="text" 
                  name="nama" 
                  className="form-input" 
                  required 
                  value={formData.nama} 
                  onChange={handleFormChange} 
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Jumlah SKS</label>
                  <input 
                    type="number" 
                    name="sks" 
                    className="form-input" 
                    required 
                    min="1" 
                    max="6"
                    value={formData.sks} 
                    onChange={handleFormChange} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipe Mata Kuliah</label>
                  <select 
                    name="tipe" 
                    className="form-select" 
                    value={formData.tipe} 
                    onChange={handleFormChange}
                  >
                    <option value="kuliah">Kuliah</option>
                    <option value="praktikum">Praktikum</option>
                    <option value="keduanya">Keduanya</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Deskripsi Singkat</label>
                <textarea 
                  name="deskripsi" 
                  className="form-textarea" 
                  value={formData.deskripsi} 
                  onChange={handleFormChange} 
                />
              </div>

              {modalMode === 'edit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <input 
                    type="checkbox" 
                    name="aktif" 
                    id="aktif" 
                    checked={formData.aktif} 
                    onChange={handleFormChange} 
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="aktif" className="form-label" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}>
                    Mata Kuliah Aktif
                  </label>
                </div>
              )}

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
    </DashboardLayout>
  );
}
