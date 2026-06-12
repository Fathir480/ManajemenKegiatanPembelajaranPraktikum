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
      setError(err.message || 'Failed to fetch course data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatkul();
  }, []);

  const handleDownloadTemplate = () => {
    const headers = [['Code', 'Name', 'Credits', 'Type', 'Description']];
    const dataRows = matkul.map(m => [
      m.kode,
      m.nama,
      m.sks,
      m.tipe === 'keduanya' ? 'both' : m.tipe === 'kuliah' ? 'lecture' : 'practicum',
      m.deskripsi || ''
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Courses');
    XLSX.writeFile(workbook, 'Course_Export_List.xlsx');
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

        // Map keys to backend expected key names (supporting both English and Indonesian templates)
        const items = rawData.map(r => {
          let tipe = r['Type'] || r['Tipe'] || 'praktikum';
          tipe = tipe.toLowerCase().trim();
          if (tipe === 'both' || tipe === 'keduanya') tipe = 'keduanya';
          else if (tipe === 'lecture' || tipe === 'kuliah') tipe = 'kuliah';
          else if (tipe === 'practicum' || tipe === 'practice' || tipe === 'praktikum') tipe = 'praktikum';

          return {
            kode: String(r['Code'] || r['Kode'] || ''),
            nama: r['Name'] || r['Nama'],
            sks: parseInt(r['Credits'] || r['SKS'] || '2'),
            tipe: tipe,
            deskripsi: r['Description'] || r['Deskripsi'] || ''
          };
        });

        const res = await api.post('/admin/matkul/bulk', { items });
        setSuccess(res.message);
        setIsBulkModalOpen(false);
        fetchMatkul();
      } catch (err) {
        setError(err.message || 'Failed to process Excel file');
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
        setSuccess('Course successfully added');
      } else {
        await api.put(`/admin/matkul/${selectedMatkul.id}`, formData);
        setSuccess('Course successfully updated');
      }
      setIsModalOpen(false);
      fetchMatkul();
    } catch (err) {
      setError(err.message || 'Failed to save data');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this course? All associated schedules will also be deleted.')) return;
    
    try {
      setError('');
      setSuccess('');
      await api.delete(`/admin/matkul/${id}`);
      setSuccess('Course successfully deleted');
      fetchMatkul();
    } catch (err) {
      setError(err.message || 'Failed to delete course');
    }
  };

  const filteredMatkul = matkul.filter(m => 
    m.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.kode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Courses">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Course Management</h1>
          <p className="page-subtitle">Manage curriculum, credits, and class grading components</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
            Bulk Import (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            Add Course
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="matkul-controls">
          <div className="search-wrapper">
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}></span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search code or course name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Showing {filteredMatkul.length} courses
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Loading data...</span>
          </div>
        ) : filteredMatkul.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No courses found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Name</th>
                  <th>Credits</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th style={{ width: '80px' }}></th>
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
                        {m.deskripsi || 'No description'}
                      </span>
                    </td>
                    <td>{m.sks} Credits</td>
                    <td>
                      <span className="badge badge-dosen" style={{ textTransform: 'capitalize' }}>
                        {m.tipe === 'keduanya' ? 'Both' : m.tipe === 'kuliah' ? 'Lecture' : 'Practicum'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${m.aktif ? 'badge-hadir' : 'badge-alpa'}`}>
                        {m.aktif ? 'Active' : 'Inactive'}
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

      {/* modal bulk upload */}
      {isBulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Course Import</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Upload an Excel file (.xlsx or .xls) to register courses in bulk. The 'Type' column can be 'lecture', 'practicum', or 'both'.
              </p>

              <button className="btn btn-outline" style={{ width: '100%', marginBottom: '24px', justifyContent: 'center' }} onClick={handleDownloadTemplate}>
                Export Data & Template (.xlsx)
              </button>

              <div className="form-group" style={{ border: '2px dashed var(--hairline-strong)', padding: '24px', borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                <span style={{ fontSize: '32px' }}></span>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', marginTop: '8px' }}>
                  Select Your Excel Template File
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

      {/* modal add/edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'add' ? 'Add Course' : 'Edit Course'}
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
                <label className="form-label">Course Code</label>
                <input 
                  type="text" 
                  name="kode" 
                  className="form-input" 
                  required 
                  disabled={modalMode === 'edit'} // Kode tidak bisa diedit setelah dibuat
                  value={formData.kode} 
                  onChange={handleFormChange} 
                  placeholder="Example: IF123"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Course Name</label>
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
                  <label className="form-label">Number of Credits</label>
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
                  <label className="form-label">Course Type</label>
                  <select 
                    name="tipe" 
                    className="form-select" 
                    value={formData.tipe} 
                    onChange={handleFormChange}
                  >
                    <option value="kuliah">Lecture</option>
                    <option value="praktikum">Practicum</option>
                    <option value="keduanya">Both</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Short Description</label>
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
                    Active Course
                  </label>
                </div>
              )}

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
