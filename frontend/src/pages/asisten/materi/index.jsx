import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import DashboardLayout from '../../../components/DashboardLayout';

export default function AsistenMateri() {
  const [kelas, setKelas] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [materi, setMateri] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deskripsi, setDeskripsi] = useState('');
  const [file, setFile] = useState(null);

  const fetchKelas = async () => {
    try {
      const data = await api.get('/asisten/kelas');
      if (Array.isArray(data)) {
        setKelas(data);
      } else {
        throw new Error('Data format invalid');
      }
    } catch (err) {
      setError('Failed to fetch class list');
    }
  };

  const fetchMateri = async (kelasId) => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/asisten/materi/${kelasId}`);
      if (Array.isArray(data)) {
        setMateri(data);
      } else {
        setMateri([]);
      }
    } catch (err) {
      setError('Failed to load materials list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKelas();
  }, []);

  useEffect(() => {
    if (selectedKelasId) {
      fetchMateri(selectedKelasId);
    } else {
      setMateri([]);
    }
  }, [selectedKelasId]);

  const handleOpenAddModal = () => {
    if (!selectedKelasId) {
      setError('Please select a class first before uploading a material.');
      return;
    }
    setDeskripsi('');
    setFile(null);
    setError('');
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!file) {
      setError('Document file is required');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kelasId', selectedKelasId);
      formData.append('judul', file.name);
      formData.append('deskripsi', deskripsi);
      formData.append('tipe', 'materi');
      formData.append('semester', 'Berjalan');

      await api.postForm('/asisten/materi', formData);
      setSuccess('Material uploaded successfully!');
      setIsModalOpen(false);
      fetchMateri(selectedKelasId);
    } catch (err) {
      setError(err.message || 'Failed to upload material');
    }
  };

  const handleDeleteMateri = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material?')) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/asisten/materi/${id}`);
      setSuccess('Material deleted successfully!');
      fetchMateri(selectedKelasId);
    } catch (err) {
      setError('Failed to delete material');
    }
  };

  return (
    <DashboardLayout title="Upload Material">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Practicum Materials & Modules</h1>
          <p className="page-subtitle">Upload, distribute, and manage practicum guideline documents for students</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal} disabled={!selectedKelasId}>
          Upload New Document
        </button>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      {kelas.length === 0 && !error && (
        <div className="alert alert-error mb-6">
          You are not assigned as an assistant for any classes in this semester. Please assign this assistant to a class via the Admin panel first.
        </div>
      )}

      <div className="card mb-6">
        <div className="form-group" style={{ maxWidth: '400px', marginBottom: '24px' }}>
          <label className="form-label">Select Class / Course</label>
          <select
            className="form-select"
            value={selectedKelasId}
            onChange={(e) => setSelectedKelasId(e.target.value)}
          >
            <option value="">-- Select Class --</option>
            {kelas.map(k => (
              <option key={k.id} value={k.id}>
                {k.namaKelas} - {k.mataKuliah?.nama || 'Unknown Course'}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : !selectedKelasId ? (
          <div className="empty-state">
            <p>Please select a class first</p>
          </div>
        ) : materi.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No material files uploaded for this class yet.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>File Information</th>
                  <th>Description</th>
                  <th>Size</th>
                  <th>Upload Date</th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {materi.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="flex gap-2" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <strong>{m.judul}</strong>
                      </div>
                    </td>
                    <td>{m.deskripsi || '-'}</td>
                    <td className="text-mono">{m.ukuranKb} KB</td>
                    <td className="text-mono">{new Date(m.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <div className="flex gap-3 justify-end" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <a 
                          href={`http://localhost:5000${m.filePath}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="action-icon-btn" 
                          title="Download File"
                          download
                          style={{ color: 'var(--primary)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </a>
                        <button className="action-icon-btn action-delete" onClick={() => handleDeleteMateri(m.id)} title="Delete File">
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

      {/* modal upload */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Upload Material File</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body" style={{ paddingBottom: '24px' }}>
                <div className="form-group mb-4">
                  <label className="form-label">File Document (PDF, DOCX, PPTX, XLSX)</label>
                  <div style={{ position: 'relative', marginTop: '12px' }}>
                    <input
                      type="file"
                      id="materi-file-upload"
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.pptx,.xlsx"
                      required
                      style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', background: 'var(--surface-soft)', border: '1px solid var(--hairline-strong)', borderRadius: 'var(--radius-md)', transition: 'border-color var(--transition)' }}>
                      <div className="btn" style={{ pointerEvents: 'none', background: 'var(--surface-hover)', color: 'var(--text-main)', border: '1px solid var(--hairline)', padding: '6px 16px', fontSize: '13px' }}>
                        Browse File
                      </div>
                      <span style={{ color: file ? 'var(--text-main)' : 'var(--muted)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file ? file.name : 'No file chosen...'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-textarea"
                    value={deskripsi}
                    onChange={e => setDeskripsi(e.target.value)}
                    placeholder="Enter brief description..."
                    rows={4}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ paddingTop: '24px', borderTop: '1px solid var(--hairline-strong)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'transparent' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!file}>Upload File</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
