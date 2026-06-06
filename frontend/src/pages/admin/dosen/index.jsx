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
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedDosen, setSelectedDosen] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    password: '',
    nid: '',
    spesialisasi: '',
    aktif: true
  });

  const fetchDosen = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/dosen');
      setDosen(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch lecturer data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDosen();
  }, []);

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      nama: '',
      email: '',
      password: '',
      nid: '',
      spesialisasi: '',
      aktif: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (d) => {
    setModalMode('edit');
    setSelectedDosen(d);
    setFormData({
      nama: d.user?.nama || '',
      email: d.user?.email || '',
      password: '', // Kosongkan saat edit
      nid: d.nid || '',
      spesialisasi: d.spesialisasi || '',
      aktif: d.user?.aktif !== undefined ? d.user?.aktif : true
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
        await api.post('/admin/dosen', formData);
        setSuccess('Lecturer successfully added');
      } else {
        await api.put(`/admin/dosen/${selectedDosen.id}`, formData);
        setSuccess('Lecturer successfully updated');
      }
      setIsModalOpen(false);
      fetchDosen();
    } catch (err) {
      setError(err.message || 'Failed to save data');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lecturer? All associated schedules or subjects will also be affected.')) return;
    
    try {
      setError('');
      setSuccess('');
      await api.delete(`/admin/dosen/${id}`);
      setSuccess('Lecturer successfully deleted');
      fetchDosen();
    } catch (err) {
      setError(err.message || 'Failed to delete lecturer');
    }
  };

  // --- BULK IMPORT EXCEL LOGIC ---
  const handleDownloadTemplate = () => {
    const headers = [['Name', 'NID', 'Specialization']];
    const mockData = [
      ['Prof. Dr. Ir. H. Anwar', 'NID-002', 'Software Engineering'],
      ['Siti Fatimah, S.T, M.T', 'NID-003', 'Artificial Intelligence']
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...mockData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'Lecturer_Import_Template.xlsx');
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

        // Map keys to backend expected key names (supporting both Indonesian and English template headers)
        const items = rawData.map(r => ({
          nama: r['Name'] || r['Nama'],
          email: r['Email'],
          nid: String(r['NID'] || ''),
          spesialisasi: r['Specialization'] || r['Spesialisasi'] || ''
        }));

        const res = await api.post('/admin/dosen/bulk', { items });
        setSuccess(res.message);
        setIsBulkModalOpen(false);
        fetchDosen();
      } catch (err) {
        setError(err.message || 'Failed to process Excel file');
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
    <DashboardLayout title="Manage Lecturers">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Lecturer Management</h1>
          <p className="page-subtitle">Manage Lecturer Identification Numbers (NID), subject specializations, and bulk data imports</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
            Bulk Import (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            Add Lecturer
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="dosen-controls">
          <div className="search-wrapper">
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}></span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search name, NID, specialization..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Showing {filteredDosen.length} lecturers
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Processing data...</span>
          </div>
        ) : filteredDosen.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No lecturers found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>NID</th>
                  <th>Specialization</th>
                  <th>Status</th>
                  <th style={{ width: '80px' }}></th>
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
                        {d.user?.aktif ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-3 justify-end" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="action-icon-btn action-edit" onClick={() => handleOpenEditModal(d)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button className="action-icon-btn action-delete" onClick={() => handleDelete(d.id)} title="Delete">
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

      {/* modal manual add */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'add' ? 'Add Lecturer' : 'Edit Lecturer'}
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

              <div className="form-group">
                <label className="form-label">NID (Lecturer Identification Number)</label>
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
                <label className="form-label">Specialization</label>
                <input 
                  type="text" 
                  name="spesialisasi" 
                  className="form-input" 
                  placeholder="Example: Software Engineering, Data Science" 
                  value={formData.spesialisasi} 
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
                  Save
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
              <h3 className="modal-title">Bulk Lecturer Import</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Upload an Excel file (.xlsx or .xls) to register lecturers in bulk with a default password of **`dosen123`**.
              </p>

              <button className="btn btn-outline" style={{ width: '100%', marginBottom: '24px', justifyContent: 'center' }} onClick={handleDownloadTemplate}>
                Download Excel Template (.xlsx)
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
    </DashboardLayout>
  );
}
