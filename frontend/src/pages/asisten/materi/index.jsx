import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import '../../dosen/materi/materi.css';

const typeMap = {
  'materi': 'Lecture Slide',
  'modul': 'Module Book',
  'referensi': 'Reference',
  'lainnya': 'Other'
};

export default function AsistenMateri() {
  const [materi, setMateri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMateri = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/asisten/materi');
      setMateri(data);
    } catch (err) {
      setError(err.message || 'Failed to load materials list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMateri();
  }, []);

  return (
    <DashboardLayout title="Course Materials">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Practicum Materials & Modules</h1>
          <p className="page-subtitle">Download materials and guidelines uploaded by course lecturers</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : materi.length === 0 ? (
          <div className="empty-state">
            <p>No materials uploaded for your assisted courses yet</p>
          </div>
        ) : (
          <div className="materi-list">
            {materi.map(m => (
              <div className="materi-item" key={m.id}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div>
                    <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{m.judul}</strong>
                      <span className="badge badge-admin" style={{ fontSize: '10px' }}>
                        {m.mataKuliah?.kode} - {m.mataKuliah?.nama}
                      </span>
                      <span className="badge badge-status-active" style={{ fontSize: '10px' }}>
                        {typeMap[m.tipe] || m.tipe}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--body)', marginBottom: '4px' }}>
                      {m.deskripsi || 'No description'}
                    </p>
                    <div className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      Lecturer: {m.dosen?.user?.nama} | Size: {m.ukuranKb} KB | Date: {new Date(m.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                
                <a 
                  href={`http://localhost:5000${m.filePath}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-primary btn-sm"
                  download
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
