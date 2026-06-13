import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import '../../dosen/materi/materi.css';

export default function PraktikanMateri() {
  const [materi, setMateri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMateri = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/praktikan/materi');
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
          <p className="page-subtitle">Download materials and guidelines uploaded by your lecturers</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : materi.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No materials have been uploaded by your lecturers yet.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>File Information</th>
                  <th>Course / Class</th>
                  <th>Sender / Uploader</th>
                  <th>Size</th>
                  <th>Upload Date</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {materi.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="flex gap-2" style={{ display: 'inline-flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                          <strong style={{ fontSize: '14px' }}>{m.judul}</strong>
                        </div>
                        {m.deskripsi && (
                          <span style={{ fontSize: '13px', color: 'var(--muted)', marginLeft: '26px' }}>{m.deskripsi}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{m.kelas?.mataKuliah?.nama || 'Unknown Course'}</strong>
                        <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.kelas?.mataKuliah?.kode || '-'}</span>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const uploaderName = m.uploader?.nama || m.dosen?.user?.nama || 'Unknown Sender';
                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'var(--surface-soft)', borderRadius: '100px', border: '1px solid var(--hairline)' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                              {uploaderName !== 'Unknown Sender' ? uploaderName.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{uploaderName}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="text-mono" style={{ fontSize: '13px' }}>{m.ukuranKb ? `${m.ukuranKb} KB` : '-'}</td>
                    <td className="text-mono" style={{ fontSize: '13px' }}>{new Date(m.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ textAlign: 'center' }}>
                      <a 
                        href={`http://localhost:5000${m.filePath}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-primary btn-sm" 
                        title="Download File"
                        download
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
