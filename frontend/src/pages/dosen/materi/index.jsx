import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './materi.css';

const typeMap = {
  'materi': 'Lecture Slide',
  'modul': 'Module Book',
  'referensi': 'Reference',
  'lainnya': 'Other'
};

export default function DosenMateri() {
  const [matkul, setMatkul] = useState([]);
  const [selectedMatkulId, setSelectedMatkulId] = useState('');
  const [materi, setMateri] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [tipe, setTipe] = useState('materi'); // 'modul' | 'materi' | 'referensi' | 'lainnya'
  const [semester, setSemester] = useState('2024/2025 Genap');
  const [file, setFile] = useState(null);

  const fetchMatkul = async () => {
    try {
      const data = await api.get('/dosen/matkul');
      setMatkul(data);
      if (data.length > 0) setSelectedMatkulId(data[0].id);
    } catch (err) {
      setError('Failed to fetch course list');
    }
  };

  useEffect(() => {
    fetchMatkul();
  }, []);

  const fetchMateri = async () => {
    if (!selectedMatkulId) {
      setMateri([]);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/dosen/materi/${selectedMatkulId}`);
      setMateri(data);
    } catch (err) {
      setError('Failed to load materials list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMateri();
  }, [selectedMatkulId]);

  const handleOpenAddModal = () => {
    setJudul('');
    setDeskripsi('');
    setTipe('materi');
    setSemester('2024/2025 Genap');
    setFile(null);
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
      formData.append('mataKuliahId', selectedMatkulId);
      formData.append('judul', judul);
      formData.append('deskripsi', deskripsi);
      formData.append('tipe', tipe);
      formData.append('semester', semester);
      formData.append('file', file);

      await api.postForm('/dosen/materi', formData);
      setSuccess('Material uploaded successfully!');
      setIsModalOpen(false);
      fetchMateri();
    } catch (err) {
      setError(err.message || 'Failed to upload material');
    }
  };

  return (
    <DashboardLayout title="Upload Material">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Practicum Materials & Modules</h1>
          <p className="page-subtitle">Upload, distribute, and manage practicum guideline documents for students</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal} disabled={!selectedMatkulId}>
          Upload New Document
        </button>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="form-group" style={{ maxWidth: '320px', marginBottom: '24px' }}>
          <label className="form-label">Course</label>
          <select
            className="form-select"
            value={selectedMatkulId}
            onChange={(e) => setSelectedMatkulId(e.target.value)}
          >
            <option value="">-- Select Course --</option>
            {matkul.map(m => (
              <option key={m.id} value={m.id}>
                {m.kode} - {m.nama}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : !selectedMatkulId ? (
          <div className="empty-state">
            <p>Please select a course first</p>
          </div>
        ) : materi.length === 0 ? (
          <div className="empty-state">
            <p>No practicum materials uploaded yet</p>
          </div>
        ) : (
          <div className="materi-list">
            {materi.map(m => (
              <div className="materi-item" key={m.id}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div>
                    <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{m.judul}</strong>
                      <span className="badge badge-status-active" style={{ fontSize: '10px' }}>
                        {typeMap[m.tipe] || m.tipe}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--body)', marginBottom: '4px' }}>
                      {m.deskripsi || 'No description'}
                    </p>
                    <div className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Size: {m.ukuranKb} KB | Date: {new Date(m.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                
                <a 
                  href={`http://localhost:5000${m.filePath}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-outline btn-sm"
                  download
                >
                  Download File
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* modal upload */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Upload New Material</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Material Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="Example: Module Session 1 - Introduction to HTML"
                  value={judul} 
                  onChange={(e) => setJudul(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Brief explanation about the material..."
                  value={deskripsi} 
                  onChange={(e) => setDeskripsi(e.target.value)} 
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Document Type</label>
                  <select 
                    className="form-select" 
                    value={tipe} 
                    onChange={(e) => setTipe(e.target.value)}
                  >
                    <option value="materi">Lecture Slide</option>
                    <option value="modul">Module Book</option>
                    <option value="referensi">Reference</option>
                    <option value="lainnya">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    value={semester} 
                    onChange={(e) => setSemester(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Select Document File (.pdf, .docx, .pptx, .xlsx - Max 20MB)</label>
                <input 
                  type="file" 
                  className="form-input" 
                  required 
                  accept=".pdf,.docx,.pptx,.xlsx"
                  onChange={handleFileChange} 
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Upload File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
