import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './kelas.css';

export default function PraktikanKelas() {
  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const data = await api.get('/praktikan/kelas');
      setClasses(data);
    } catch (err) {
      setError(err.message || 'Gagal mengambil data kelas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleEnroll = async (kelasId) => {
    try {
      setError('');
      setSuccess('');
      const res = await api.post('/praktikan/kelas/enroll', { kelasId });
      setSuccess(res.message || 'Berhasil mendaftar ke kelas.');
      await fetchClasses();
    } catch (err) {
      setError(err.message || 'Gagal mendaftar ke kelas.');
    }
  };

  const handleDrop = async (kelasId, namaKelas) => {
    if (!window.confirm(`Apakah Anda yakin ingin keluar dari kelas "${namaKelas}"?`)) return;
    try {
      setError('');
      setSuccess('');
      const res = await api.post('/praktikan/kelas/drop', { kelasId });
      setSuccess(res.message || 'Berhasil keluar dari kelas.');
      await fetchClasses();
    } catch (err) {
      setError(err.message || 'Gagal keluar dari kelas.');
    }
  };

  const filteredClasses = classes.filter(c => 
    c.namaKelas.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.mataKuliah?.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.mataKuliah?.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.dosen.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate summary
  const enrolledClassesCount = classes.filter(c => c.isEnrolled).length;
  const totalSks = classes.filter(c => c.isEnrolled).reduce((sum, c) => sum + (c.mataKuliah?.sks || 0), 0);

  return (
    <DashboardLayout title="Class Enrollment">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Class Enrollment</h1>
          <p className="page-subtitle">Enroll in active classes and manage your semester study plan (KRS)</p>
        </div>
        <div className="flex gap-4">
          <div className="stat-badge">
            <span className="stat-badge-label">Classes Enrolled</span>
            <span className="stat-badge-value">{enrolledClassesCount}</span>
          </div>
          <div className="stat-badge">
            <span className="stat-badge-label">Total Credits (SKS)</span>
            <span className="stat-badge-value">{totalSks}</span>
          </div>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="kelas-enroll-controls">
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
              placeholder="Search course, class, or lecturer..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Showing {filteredClasses.length} classes
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Processing data...</span>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No classes found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Course Code & Name</th>
                  <th>Class Group</th>
                  <th>Lecturer</th>
                  <th>Semester</th>
                  <th>Enrolled</th>
                  <th>Status</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.mataKuliah?.nama}</strong>
                      <br />
                      <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {c.mataKuliah?.kode} • {c.mataKuliah?.sks} SKS
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.namaKelas}</td>
                    <td>{c.dosen}</td>
                    <td>{c.semester}</td>
                    <td className="text-mono">{c.studentCount} Students</td>
                    <td>
                      <span className={`badge ${c.isEnrolled ? 'badge-status-active' : 'badge-status-inactive'}`}>
                        {c.isEnrolled ? 'Enrolled' : 'Not Enrolled'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {c.isEnrolled ? (
                        <button 
                          className="btn btn-danger btn-sm" 
                          style={{ width: '90px' }}
                          onClick={() => handleDrop(c.id, c.namaKelas)}
                        >
                          Drop
                        </button>
                      ) : (
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ width: '90px' }}
                          onClick={() => handleEnroll(c.id)}
                        >
                          Enroll
                        </button>
                      )}
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
