import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './absensi.css';

export default function AdminAbsensi() {
  const [classes, setClasses] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Date Editing Modal State
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [modalError, setModalError] = useState('');

  // Fetch all classes for the dropdown selector
  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const data = await api.get('/admin/kelas');
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
      setSuccess('');
      const data = await api.get(`/admin/absensi/kelas/${kelasId}`);
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

  // Update attendance status manually
  const handleStatusChange = async (studentId, sessionId, newStatus) => {
    try {
      setError('');
      setSuccess('');
      await api.put('/admin/absensi/update', {
        sesiId: sessionId,
        mahasiswaId: studentId,
        status: newStatus
      });

      // Update local state to reflect change instantly
      setAttendance(prev => {
        const index = prev.findIndex(a => a.mahasiswaId === studentId && a.sesiId === sessionId);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], status: newStatus };
          return updated;
        } else {
          return [...prev, { sesiId: sessionId, mahasiswaId: studentId, status: newStatus }];
        }
      });
      setSuccess('Attendance status updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update attendance status.');
    }
  };

  // Open date editing modal
  const openDateModal = (session) => {
    setEditingSession(session);
    // Format date string from DB (usually ISO string) to YYYY-MM-DD for date input
    const dateStr = session.tanggal ? new Date(session.tanggal).toISOString().split('T')[0] : '';
    setNewDate(dateStr);
    setModalError('');
    setIsDateModalOpen(true);
  };

  // Submit new date for the session
  const handleDateSubmit = async (e) => {
    e.preventDefault();
    if (!newDate) {
      setModalError('Please select a valid date.');
      return;
    }
    try {
      setModalError('');
      const res = await api.put(`/admin/absensi/sesi/${editingSession.id}`, { tanggal: newDate });
      
      // Update local sessions state
      setSessions(prev => 
        prev.map(s => s.id === editingSession.id ? { ...s, tanggal: res.updatedSesi.tanggal } : s)
      );

      setSuccess('Session date updated successfully.');
      setIsDateModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'Failed to update session date.');
    }
  };

  // Format date for display
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const handleExportExcel = () => {
    const dateHeaders = sessions.map(s => formatDateDisplay(s.tanggal));
    const headers = [['Student Name', 'NIM / Stambuk', ...dateHeaders]];
    
    const dataRows = students.map(std => {
      const row = [std.nama, std.stambuk];
      sessions.forEach(s => {
        const status = getAttendanceStatus(std.id, s.id);
        const initial = status === 'hadir' ? 'H' : status === 'izin' ? 'I' : status === 'sakit' ? 'S' : 'A';
        row.push(initial);
      });
      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Matrix');
    
    const selectedClass = classes.find(c => String(c.id) === selectedKelasId);
    const classNameStr = selectedClass ? `${selectedClass.namaKelas}_${selectedClass.mataKuliah?.nama}`.replace(/[^a-zA-Z0-9_]/g, '_') : 'Class';
    
    XLSX.writeFile(workbook, `Attendance_Matrix_${classNameStr}.xlsx`);
  };

  return (
    <DashboardLayout title="Manage Attendance">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Practical Course Attendance</h1>
          <p className="page-subtitle">Monitor student attendance logs, modify session dates, and override individual attendance statuses</p>
        </div>
        <div className="flex gap-3">
          {selectedKelasId && students.length > 0 && sessions.length > 0 && (
            <button className="btn btn-ghost" onClick={handleExportExcel}>
              Export to Excel
            </button>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="absensi-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div className="form-group mb-0" style={{ minWidth: '320px', flexGrow: 0 }}>
            <label className="form-label text-mono" style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>Select Class Group</label>
            {loadingClasses ? (
              <div className="text-muted text-mono" style={{ fontSize: '12px' }}>Loading classes list...</div>
            ) : (
              <select 
                className="form-select text-mono" 
                value={selectedKelasId} 
                onChange={handleKelasChange}
                style={{ width: '100%', fontSize: '13px', textTransform: 'uppercase' }}
              >
                <option value="">-- Select Class --</option>
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
            <p>Please select a class group from the dropdown list above.</p>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0' }}>
            <p>No students enrolled in this class group yet.</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0', border: '2px dashed var(--hairline-strong)' }}>
            <p className="mb-4">No attendance sessions found for this class.</p>
            <div className="alert alert-info text-center" style={{ maxWidth: '480px', margin: '0 auto', fontSize: '13px' }}>
              <strong>Notice:</strong> Sesi absensi terbuat secara otomatis saat Anda melakukan <strong>Verify Semester</strong> di halaman jadwal untuk jadwal yang terkait kelas ini.
            </div>
          </div>
        ) : (
          /* MATRIX ATTENDANCE TABLE */
          <div className="table-wrapper absensi-matrix-wrapper" style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table className="absensi-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '260px', minWidth: '260px', textAlign: 'left', background: 'var(--surface-strong)', color: 'var(--ink)', position: 'sticky', left: 0, zIndex: 11 }}>
                    Student Name / NIM
                  </th>
                  {sessions.map(s => (
                    <th key={s.id} style={{ minWidth: '80px', textAlign: 'center', background: 'var(--surface-soft)', color: 'var(--ink)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <span className="text-mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                          {formatDateDisplay(s.tanggal)}
                        </span>
                        <button 
                          type="button" 
                          className="action-icon-btn action-edit"
                          onClick={() => openDateModal(s)}
                          style={{ padding: '2px', display: 'inline-flex' }}
                          title="Change Date"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </button>
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
                          <select
                            className={`status-select status-${currentStatus}`}
                            value={currentStatus}
                            onChange={(e) => handleStatusChange(std.id, s.id, e.target.value)}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '4px',
                              padding: '2px 4px',
                              border: '1px solid var(--hairline-strong)',
                              cursor: 'pointer',
                              width: '48px',
                              textAlign: 'center',
                              textTransform: 'uppercase'
                            }}
                          >
                            <option value="hadir">H</option>
                            <option value="izin">I</option>
                            <option value="sakit">S</option>
                            <option value="alpa">A</option>
                          </select>
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

      {/* DATE EDITING MODAL */}
      {isDateModalOpen && editingSession && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Session Date</h3>
              <button className="modal-close" onClick={() => setIsDateModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleDateSubmit} className="login-form">
              {modalError && <div className="alert alert-error mb-4">{modalError}</div>}
              
              <div style={{ fontSize: '13px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.5 }}>
                Ubah tanggal absensi untuk <strong>Sesi Pertemuan Ke-{editingSession.pertemuanKe}</strong>. 
                Hal ini akan memindahkan tanggal sesi tersebut untuk semua absensi mahasiswa.
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Baru</label>
                <input 
                  type="date"
                  className="form-input"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsDateModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Ubah Tanggal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
