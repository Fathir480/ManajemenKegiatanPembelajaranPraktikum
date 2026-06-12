import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './kelas.css';

export default function KelolaKelas() {
  const [kelas, setKelas] = useState([]);
  const [mataKuliahList, setMataKuliahList] = useState([]);
  const [dosenList, setDosenList] = useState([]);
  const [mahasiswaList, setMahasiswaList] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPesertaModalOpen, setIsPesertaModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedKelas, setSelectedKelas] = useState(null);
  
  // Peserta State
  const [pesertaKelas, setPesertaKelas] = useState([]);
  const [selectedMhsToAdd, setSelectedMhsToAdd] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    namaKelas: '',
    mataKuliahId: '',
    dosenId: '',
    jumlahKelas: 1,
    aktif: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kelasData, mkData, dosenData, mhsData] = await Promise.all([
        api.get('/admin/kelas'),
        api.get('/admin/matkul'),
        api.get('/admin/dosen'),
        api.get('/admin/mahasiswa')
      ]);
      setKelas(kelasData);
      setMataKuliahList(mkData);
      setDosenList(dosenData);
      setMahasiswaList(mhsData);
      setError('');
    } catch (err) {
      setError(err.message || 'Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      namaKelas: '',
      mataKuliahId: '',
      dosenId: '',
      jumlahKelas: 1,
      aktif: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (k) => {
    setModalMode('edit');
    setSelectedKelas(k);
    setFormData({
      namaKelas: k.namaKelas,
      mataKuliahId: k.mataKuliahId,
      dosenId: k.dosenId || '',
      jumlahKelas: 1,
      aktif: k.aktif
    });
    setIsModalOpen(true);
  };

  const handleOpenPesertaModal = async (k) => {
    setSelectedKelas(k);
    setIsPesertaModalOpen(true);
    await fetchPeserta(k.id);
  };

  const fetchPeserta = async (kelasId) => {
    try {
      const data = await api.get(`/admin/kelas/${kelasId}/peserta`);
      setPesertaKelas(data);
    } catch (err) {
      setError(err.message || 'Gagal mengambil peserta kelas');
    }
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
        await api.post('/admin/kelas', {
          mataKuliahId: formData.mataKuliahId,
          dosenId: formData.dosenId || null,
          jumlahKelas: parseInt(formData.jumlahKelas) || 1
        });
        setSuccess('Classes successfully generated');
      } else {
        await api.put(`/admin/kelas/${selectedKelas.id}`, {
          namaKelas: formData.namaKelas,
          mataKuliahId: formData.mataKuliahId,
          dosenId: formData.dosenId || null,
          aktif: formData.aktif
        });
        setSuccess('Class successfully updated');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan data kelas');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus kelas ini?')) return;
    
    try {
      setSuccess('');
      setError('');
      await api.delete(`/admin/kelas/${id}`);
      setSuccess('Class successfully deleted');
      fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menghapus kelas');
    }
  };

  const handleAddPeserta = async () => {
    if (!selectedMhsToAdd) return;
    try {
      setError('');
      setSuccess('');
      await api.post(`/admin/kelas/${selectedKelas.id}/peserta`, {
        mahasiswaIds: [selectedMhsToAdd]
      });
      setSuccess('Student successfully enrolled in class');
      fetchPeserta(selectedKelas.id);
      fetchData(); // Update count
      setSelectedMhsToAdd('');
    } catch (err) {
      setError(err.message || 'Gagal menambahkan peserta');
    }
  };

  const handleRemovePeserta = async (mahasiswaId) => {
    try {
      setError('');
      setSuccess('');
      await api.delete(`/admin/kelas/${selectedKelas.id}/peserta/${mahasiswaId}`);
      setSuccess('Student successfully removed from class');
      fetchPeserta(selectedKelas.id);
      fetchData(); // Update count
    } catch (err) {
      setError(err.message || 'Gagal menghapus peserta');
    }
  };

  const handleExportExcel = () => {
    const headers = [['Class Name', 'Course Code', 'Lecturer NID', 'Course Name', 'Lecturer Name', 'Total Participants', 'Status']];
    const dataRows = filteredKelas.map(k => [
      k.namaKelas || '',
      k.mataKuliah?.kode || '',
      k.dosen?.nid || '',
      k.mataKuliah?.nama || '',
      k.dosen?.user?.nama || '',
      k._count?.pesertaKelas || 0,
      k.aktif ? 'Active' : 'Inactive'
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Classes');
    XLSX.writeFile(workbook, 'Class_List.xlsx');
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
          setError('Excel file is empty or format is invalid');
          setLoading(false);
          return;
        }

        const items = rawData.map(r => ({
          namaKelas: String(r['Class Name'] || r['Nama Kelas'] || r['Kelas'] || ''),
          mataKuliahKode: String(r['Course Code'] || r['Kode Matakuliah'] || r['Kode Matkul'] || ''),
          dosenNID: String(r['Lecturer NID'] || r['NID Dosen'] || r['NID'] || '')
        }));

        const res = await api.post('/admin/kelas/bulk', { items });
        setSuccess(res.message);
        setIsBulkModalOpen(false);
        fetchData();
      } catch (err) {
        setError(err.message || 'Failed to process Excel file');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredKelas = kelas.filter(k => 
    k.namaKelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.mataKuliah?.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Manage Classes">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Class Management</h1>
          <p className="page-subtitle">Manage academic classes, assign lecturers, and enroll student participants (KRS)</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
            Bulk Import (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            Add Class
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="kelas-controls">
          <div className="search-wrapper" style={{ position: 'relative', width: '320px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search class or course name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Showing {filteredKelas.length} classes
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Processing data...</span>
          </div>
        ) : filteredKelas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No classes found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Course</th>
                  <th>Lecturer</th>
                  <th>Participants</th>
                  <th>Status</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredKelas.map((k) => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 600 }}>{k.namaKelas}</td>
                    <td>{k.mataKuliah?.nama || '-'}</td>
                    <td>{k.dosen?.user?.nama || '-'}</td>
                    <td>
                      <span 
                        className="badge badge-dosen cursor-pointer" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleOpenPesertaModal(k)}
                        title="Manage Participants"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>{k._count?.pesertaKelas || 0} Students</span>
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${k.aktif ? 'badge-status-active' : 'badge-status-inactive'}`}>
                        {k.aktif ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-3 justify-end" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="action-icon-btn action-edit" onClick={() => handleOpenEditModal(k)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button className="action-icon-btn action-delete" onClick={() => handleDelete(k.id)} title="Delete">
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

      {/* Modal Tambah/Edit Kelas */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'add' ? 'Add Class' : 'Edit Class'}
              </h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              {modalMode === 'add' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Course (Mata Kuliah)</label>
                    <select 
                      name="mataKuliahId" 
                      className="form-select"
                      value={formData.mataKuliahId} 
                      onChange={handleFormChange} 
                      required
                    >
                      <option value="">-- Select Course --</option>
                      {mataKuliahList.map(mk => (
                        <option key={mk.id} value={mk.id}>{mk.kode} - {mk.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Number of Classes to Create</label>
                    <input 
                      type="number"
                      name="jumlahKelas"
                      className="form-input"
                      min="1"
                      max="10"
                      required
                      value={formData.jumlahKelas}
                      onChange={handleFormChange}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Class Name</label>
                    <input 
                      type="text" 
                      name="namaKelas" 
                      className="form-input" 
                      required 
                      value={formData.namaKelas} 
                      onChange={handleFormChange} 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Course (Mata Kuliah)</label>
                    <select 
                      name="mataKuliahId" 
                      className="form-select"
                      value={formData.mataKuliahId} 
                      onChange={handleFormChange} 
                      required
                    >
                      <option value="">-- Select Course --</option>
                      {mataKuliahList.map(mk => (
                        <option key={mk.id} value={mk.id}>{mk.kode} - {mk.nama}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Lecturer (Dosen Pengampu)</label>
                    <select 
                      name="dosenId" 
                      className="form-select"
                      value={formData.dosenId || ''} 
                      onChange={handleFormChange}
                    >
                      <option value="">-- Select Lecturer --</option>
                      {dosenList.map(d => (
                        <option key={d.id} value={d.id}>{d.nid} - {d.user?.nama}</option>
                      ))}
                    </select>
                  </div>

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
                      Active Class
                    </label>
                  </div>
                </>
              )}

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'add' ? 'Generate Classes' : 'Save Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Peserta (KRS) */}
      {isPesertaModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                Manage Participants: {selectedKelas?.namaKelas}
              </h3>
              <button className="modal-close" onClick={() => setIsPesertaModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="login-form">
              <div className="add-peserta-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select 
                  className="form-select"
                  value={selectedMhsToAdd} 
                  onChange={(e) => setSelectedMhsToAdd(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Choose Student to Add --</option>
                  {mahasiswaList
                    .filter(m => !pesertaKelas.some(pk => pk.mahasiswaId === m.id))
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.stambuk} - {m.user?.nama}</option>
                    ))
                  }
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleAddPeserta} disabled={!selectedMhsToAdd}>
                  Add
                </button>
              </div>
              
              <h4 style={{ marginTop: '20px', marginBottom: '10px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>
                Enrolled Students ({pesertaKelas.length})
              </h4>
              
              {pesertaKelas.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <p>No students enrolled yet</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Stambuk</th>
                        <th>Name</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pesertaKelas.map(pk => (
                        <tr key={pk.id}>
                          <td className="text-mono">{pk.mahasiswa?.stambuk}</td>
                          <td><strong>{pk.mahasiswa?.user?.nama}</strong></td>
                          <td>
                            <button 
                              className="action-icon-btn action-delete" 
                              title="Remove from class"
                              onClick={() => handleRemovePeserta(pk.mahasiswaId)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsPesertaModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* modal bulk upload */}
      {isBulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Class Import</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Upload an Excel spreadsheet (.xlsx or .xls) to register classes in bulk.
              </p>

              <button className="btn btn-outline" style={{ width: '100%', marginBottom: '24px', justifyContent: 'center' }} onClick={handleExportExcel}>
                Export Data & Template (.xlsx)
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
