import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';

export default function DosenAbsensi() {
  const [classes, setClasses] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState('');

  // Fetch all classes for the dropdown selector
  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const data = await api.get('/dosen/kelas');
      setClasses(data);
      // Select the first class by default if available
      if (data.length > 0) {
        setSelectedKelasId(String(data[0].id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load classes.');
    } finally {
      setLoadingClasses(false);
    }
  };

  // Fetch students, sessions, and attendance matrices for the selected class
  const fetchAttendanceData = async (kelasId) => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/dosen/absensi/kelas/${kelasId}`);
      setStudents(data.students || []);
      setSessions(data.sessions || []);
      setAttendance(data.attendance || []);
    } catch (err) {
      setError(err.message || 'Failed to load class attendance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedKelasId) {
      fetchAttendanceData(selectedKelasId);
    } else {
      setStudents([]);
      setSessions([]);
      setAttendance([]);
    }
  }, [selectedKelasId]);

  // Handle dropdown selection change
  const handleKelasChange = (e) => {
    setSelectedKelasId(e.target.value);
  };

  // Get status for a specific student and session
  const getAttendanceStatus = (studentId, sessionId) => {
    const record = attendance.find(a => a.mahasiswaId === studentId && a.sesiId === sessionId);
    return record ? record.status : 'alpa'; // Default is alpa if not recorded
  };

  // Format date for display
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  return (
    <DashboardLayout title="Rekap Absensi Praktikum (Read-Only)">
      <div className="card mb-6">
        <div className="card-header" style={{ borderBottom: '1px solid var(--hairline)', paddingBottom: '16px', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Matriks Absensi Kelas
            </h3>
            <p className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
              Tampilan read-only daftar kehadiran mahasiswa untuk setiap sesi praktikum.
            </p>
          </div>
        </div>

        {error && <div className="alert alert-error mb-6">{error}</div>}

        {/* Filter Section */}
        <div className="filter-section" style={{ background: 'var(--surface-soft)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pilih Kelas Praktikum
            </label>
            {loadingClasses ? (
              <div className="text-muted text-mono" style={{ fontSize: '13px', padding: '8px 0' }}>Loading classes...</div>
            ) : (
              <select 
                className="form-select" 
                value={selectedKelasId} 
                onChange={handleKelasChange}
                style={{ maxWidth: '400px', backgroundColor: 'var(--surface)', fontWeight: 500 }}
              >
                <option value="" disabled>-- Pilih Kelas --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.namaKelas} - {c.mataKuliah?.nama} ({c.mataKuliah?.kode})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Compiling attendance matrix...</span>
          </div>
        ) : !selectedKelasId ? (
          <div className="empty-state" style={{ padding: '80px 0' }}>
            <p>Silakan pilih kelas pada opsi di atas.</p>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0' }}>
            <p>Tidak ada mahasiswa yang terdaftar pada kelas ini.</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0', border: '2px dashed var(--hairline-strong)' }}>
            <p className="mb-4">Sesi absensi untuk kelas ini belum tersedia.</p>
          </div>
        ) : (
          /* MATRIX ATTENDANCE TABLE */
          <div className="table-wrapper absensi-matrix-wrapper" style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table className="absensi-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '260px', minWidth: '260px', textAlign: 'left', background: 'var(--surface-strong)', color: 'var(--ink)', position: 'sticky', left: 0, zIndex: 11 }}>
                    Nama Mahasiswa / NIM
                  </th>
                  {sessions.map(s => (
                    <th key={s.id} style={{ minWidth: '80px', textAlign: 'center', background: 'var(--surface-soft)', color: 'var(--ink)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <span className="text-mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                          {formatDateDisplay(s.tanggal)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map(std => (
                  <tr key={std.id}>
                    <td className="student-profile-cell" style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 9, borderRight: '2px solid var(--hairline-strong)', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong className="text-ink" style={{ fontSize: '13px' }}>{std.nama}</strong>
                        <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          {std.stambuk}
                        </span>
                      </div>
                    </td>
                    {sessions.map(s => {
                      const currentStatus = getAttendanceStatus(std.id, s.id);
                      return (
                        <td key={s.id} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '6px 4px' }}>
                          <span
                            className={`badge badge-status-${currentStatus === 'hadir' ? 'active' : 'inactive'}`}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '4px',
                              padding: '2px 4px',
                              display: 'inline-block',
                              width: '32px',
                              textAlign: 'center',
                              textTransform: 'uppercase'
                            }}
                          >
                            {currentStatus === 'hadir' ? 'H' : currentStatus === 'izin' ? 'I' : currentStatus === 'sakit' ? 'S' : 'A'}
                          </span>
                        </td>
                      );
                    })}
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
