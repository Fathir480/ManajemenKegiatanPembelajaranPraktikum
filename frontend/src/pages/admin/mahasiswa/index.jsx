import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './mahasiswa.css';

export default function KelolaMahasiswa() {
  const [mahasiswa, setMahasiswa] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedMhs, setSelectedMhs] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    password: '',
    stambuk: '',
    angkatan: new Date().getFullYear(),
    programStudi: '',
    aktif: true
  });

  const fetchMahasiswa = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/mahasiswa');
      setMahasiswa(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Gagal mengambil data mahasiswa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMahasiswa();
  }, []);

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      nama: '',
      email: '',
      password: '',
      stambuk: '',
      angkatan: new Date().getFullYear(),
      programStudi: '',
      aktif: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mhs) => {
    setModalMode('edit');
    setSelectedMhs(mhs);
    setFormData({
      nama: mhs.user?.nama || '',
      email: mhs.user?.email || '',
      password: '', // Kosongkan saat edit
      stambuk: mhs.stambuk || '',
      angkatan: mhs.angkatan || new Date().getFullYear(),
      programStudi: mhs.programStudi || '',
      aktif: mhs.user?.aktif !== undefined ? mhs.user?.aktif : true
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
        const res = await api.post('/admin/mahasiswa', formData);
        setSuccess(res.message || 'Mahasiswa berhasil ditambahkan');
      } else {
        await api.put(`/admin/mahasiswa/${selectedMhs.id}`, formData);
        setSuccess('Data mahasiswa berhasil diperbarui');
      }
      setIsModalOpen(false);
      fetchMahasiswa();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan data');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus mahasiswa ini? Semua nilai dan absensinya juga akan terhapus.')) return;
    
    try {
      setSuccess('');
      setError('');
      await api.delete(`/admin/mahasiswa/${id}`);
      setSuccess('Mahasiswa berhasil dihapus');
      fetchMahasiswa();
    } catch (err) {
      setError(err.message || 'Gagal menghapus mahasiswa');
    }
  };

  const handleToggleAsisten = async (m) => {
    const isAsisten = m.user?.role?.namaRole === 'asisten';
    const action = isAsisten ? 'demote' : 'promote';
    const message = isAsisten 
      ? `Are you sure you want to demote ${m.user?.nama} back to a regular student?`
      : `Are you sure you want to promote ${m.user?.nama} to Assistant?`;
      
    if (!window.confirm(message)) return;

    try {
      setError('');
      setSuccess('');
      const res = await api.post(`/admin/asisten/${action}`, { userId: m.user?.id });
      setSuccess(res.message || `Successfully ${isAsisten ? 'demoted' : 'promoted'} student.`);
      fetchMahasiswa();
    } catch (err) {
      setError(err.message || 'Failed to toggle assistant status.');
    }
  };

  // --- BULK IMPORT EXCEL LOGIC ---
  const handleDownloadTemplate = () => {
    const headers = [['Nama', 'Stambuk', 'Angkatan', 'Program Studi']];
    const mockData = [
      ['Siti Aminah', 'H071231024', 2023, 'Sistem Informasi'],
      ['Budi Gunawan', 'H071231055', 2023, 'Sistem Informasi']
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...mockData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'Template_Impor_Mahasiswa.xlsx');
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
          stambuk: String(r['Stambuk'] || ''),
          angkatan: parseInt(r['Angkatan']),
          programStudi: r['Program Studi'] || ''
        }));

        const res = await api.post('/admin/mahasiswa/bulk', { items });
        setSuccess(res.message);
        setIsBulkModalOpen(false);
        fetchMahasiswa();
      } catch (err) {
        setError(err.message || 'Gagal memproses berkas Excel');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredMhs = mahasiswa.filter(m => 
    m.user?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.stambuk?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.programStudi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Manage Students">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Student Management</h1>
          <p className="page-subtitle">Manage academic practitioners, student ID stambuks, class partition groups, and QR codes.</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
            Bulk Import (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            Add Student
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="mahasiswa-controls">
          <div className="search-input-wrapper">
            <span className="search-icon"></span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search name, stambuk, major..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Showing {filteredMhs.length} students
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Processing data...</span>
          </div>
        ) : filteredMhs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No students found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Student ID (Stambuk)</th>
                  <th>Cohort</th>
                  <th>Major</th>
                  <th>Status</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredMhs.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="flex gap-2" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <button 
                          className="action-icon-btn action-star" 
                          onClick={() => handleToggleAsisten(m)} 
                          title={m.user?.role?.namaRole === 'asisten' ? 'Demote from Assistant' : 'Promote to Assistant'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: m.user?.role?.namaRole === 'asisten' ? '#ffc107' : 'var(--muted)' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill={m.user?.role?.namaRole === 'asisten' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                        <strong>{m.user?.nama}</strong>
                      </div>
                      <br />
                      <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '27px' }}>
                        {m.user?.email}
                      </span>
                    </td>
                    <td className="text-mono">{m.stambuk}</td>
                    <td>{m.angkatan}</td>
                    <td>{m.programStudi || '-'}</td>
                    <td>
                      <span className={`badge ${m.user?.aktif ? 'badge-status-active' : 'badge-status-inactive'}`}>
                        {m.user?.aktif ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-3 justify-end" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="action-icon-btn action-edit" onClick={() => handleOpenEditModal(m)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button className="action-icon-btn action-delete" onClick={() => handleDelete(m.id)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* modal manual add/edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'add' ? 'Add Student' : 'Edit Student'}
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Full Name</label>
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
                  <label className="form-label">Student ID / NIM</label>
                  <input 
                    type="text" 
                    name="stambuk" 
                    className="form-input" 
                    required 
                    value={formData.stambuk} 
                    onChange={handleFormChange} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cohort Year</label>
                  <input 
                    type="number" 
                    name="angkatan" 
                    className="form-input" 
                    required 
                    value={formData.angkatan} 
                    onChange={handleFormChange} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Program of Study / Major</label>
                <input 
                  type="text" 
                  name="programStudi" 
                  className="form-input" 
                  value={formData.programStudi} 
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
                    Active Account / Grant Login
                  </label>
                </div>
              )}

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Student
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
              <h3 className="modal-title">Bulk Student Import</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Upload an Excel spreadsheet (.xlsx or .xls) to register students in bulk.
              </p>

              <button className="btn btn-outline" style={{ width: '100%', marginBottom: '24px', justifyContent: 'center' }} onClick={handleDownloadTemplate}>
                Download Excel Template (.xlsx)
              </button>

              <div className="form-group" style={{ border: '2px dashed var(--hairline-strong)', padding: '24px', borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                <span style={{ fontSize: '32px' }}></span>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginTop: '8px' }}>
                  Select Excel Template File
                </div>
                <div className="text-muted text-mono" style={{ fontSize: '11px', marginTop: '4px' }}>
                  Only supports .xlsx and .xls formats
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
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
