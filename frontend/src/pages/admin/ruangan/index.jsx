import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './ruangan.css';

export default function KelolaRuangan() {
  const [ruangan, setRuangan] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedRuangan, setSelectedRuangan] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    kode: '',
    nama: '',
    kapasitas: ''
  });

  const fetchRuangan = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/ruangan');
      setRuangan(data);
    } catch (err) {
      setError(err.message || 'Gagal memuat data ruangan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuangan();
  }, []);

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      kode: '',
      nama: '',
      kapasitas: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (r) => {
    setModalMode('edit');
    setSelectedRuangan(r);
    setFormData({
      kode: r.kode || '',
      nama: r.nama || '',
      kapasitas: r.kapasitas !== null && r.kapasitas !== undefined ? String(r.kapasitas) : ''
    });
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const payload = {
        kode: formData.kode,
        nama: formData.nama,
        kapasitas: formData.kapasitas ? parseInt(formData.kapasitas) : null
      };

      if (modalMode === 'add') {
        await api.post('/admin/ruangan', payload);
        setSuccess('Ruangan berhasil ditambahkan');
      } else {
        await api.put(`/admin/ruangan/${selectedRuangan.id}`, payload);
        setSuccess('Ruangan berhasil diperbarui');
      }
      setIsModalOpen(false);
      fetchRuangan();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan data ruangan.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus ruangan ini? Jadwal praktikum yang terkait dengan ruangan ini akan diset menjadi kosong.')) return;

    try {
      setError('');
      setSuccess('');
      await api.delete(`/admin/ruangan/${id}`);
      setSuccess('Ruangan berhasil dihapus');
      fetchRuangan();
    } catch (err) {
      setError(err.message || 'Gagal menghapus ruangan.');
    }
  };

  const handleExportExcel = () => {
    const headers = [['Room Code', 'Lab Room Name', 'Capacity']];
    const dataRows = filteredRuangan.map(r => [
      r.kode || '',
      r.nama || '',
      r.kapasitas || ''
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lab Rooms');
    XLSX.writeFile(workbook, 'Lab_Rooms_List.xlsx');
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
          kode: String(r['Room Code'] || r['Kode Ruangan'] || r['Kode'] || ''),
          nama: String(r['Lab Room Name'] || r['Nama Ruangan'] || r['Nama'] || ''),
          kapasitas: r['Capacity'] || r['Kapasitas'] || null
        }));

        const res = await api.post('/admin/ruangan/bulk', { items });
        setSuccess(res.message);
        setIsBulkModalOpen(false);
        fetchRuangan();
      } catch (err) {
        setError(err.message || 'Failed to process Excel file');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredRuangan = ruangan.filter(r =>
    r.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.kode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Lab Management">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Lab Management</h1>
          <p className="page-subtitle">Manage practicum lab rooms, codes, and student capacities</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
            Bulk Import (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            Add Lab Room
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="ruangan-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
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
              placeholder="Search by code or lab name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Showing {filteredRuangan.length} rooms
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Loading data...</span>
          </div>
        ) : filteredRuangan.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No lab rooms found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Room Code</th>
                  <th>Lab Room Name</th>
                  <th style={{ width: '200px' }}>Capacity</th>
                  <th style={{ width: '100px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRuangan.map(r => (
                  <tr key={r.id}>
                    <td className="text-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.kode}</td>
                    <td>
                      <strong>{r.nama}</strong>
                    </td>
                    <td>
                      {r.kapasitas ? (
                        <span className="badge badge-dosen" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                          </svg>
                          <span>{r.kapasitas} Students</span>
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-3 justify-end" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="action-icon-btn action-edit" onClick={() => handleOpenEditModal(r)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button className="action-icon-btn action-delete" onClick={() => handleDelete(r.id)} title="Delete">
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

      {/* modal add/edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === 'add' ? 'Add Lab Room' : 'Edit Lab Room'}
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
                <label className="form-label">Room Code</label>
                <input
                  type="text"
                  name="kode"
                  className="form-input"
                  required
                  placeholder="Example: LAB-A"
                  value={formData.kode}
                  onChange={handleFormChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Room Name</label>
                <input
                  type="text"
                  name="nama"
                  className="form-input"
                  required
                  placeholder="Example: Laboratorium Rekayasa Perangkat Lunak"
                  value={formData.nama}
                  onChange={handleFormChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Capacity (Optional)</label>
                <input
                  type="number"
                  name="kapasitas"
                  className="form-input"
                  min="1"
                  placeholder="Example: 30"
                  value={formData.kapasitas}
                  onChange={handleFormChange}
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
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
              <h3 className="modal-title">Bulk Lab Room Import</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Upload an Excel spreadsheet (.xlsx or .xls) to register lab rooms in bulk.
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
