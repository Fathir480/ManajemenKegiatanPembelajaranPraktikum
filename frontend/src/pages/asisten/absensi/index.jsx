import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import { Html5Qrcode } from 'html5-qrcode';
import '../../admin/absensi/absensi.css';

export default function AsistenAbsensi() {
  const [classes, setClasses] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Track unsaved attendance changes
  const [pendingChanges, setPendingChanges] = useState({});

  // Scanner Modal State
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scanSessionId, setScanSessionId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Fetch all classes for the dropdown selector
  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const data = await api.get('/asisten/kelas');
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
      setPendingChanges({});
      const data = await api.get(`/asisten/absensi/kelas/${kelasId}`);
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
      setPendingChanges({});
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

  // Update attendance status locally
  const handleStatusChange = (studentId, sessionId, newStatus) => {
    setPendingChanges(prev => ({
      ...prev,
      [`${studentId}-${sessionId}`]: { studentId, sessionId, newStatus }
    }));

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
  };

  // Save all pending changes to the backend
  const handleSaveAll = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const changes = Object.values(pendingChanges);
      
      // Use Promise.all to save all updates concurrently
      await Promise.all(changes.map(c => 
        api.post('/asisten/absensi/manual', {
          sesiId: c.sessionId,
          mahasiswaId: c.studentId,
          status: c.newStatus
        })
      ));

      setSuccess(`Successfully saved ${changes.length} attendance changes.`);
      setPendingChanges({}); // Clear pending changes
    } catch (err) {
      setError(err.message || 'Failed to update attendance status.');
    } finally {
      setLoading(false);
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

  // QR Scanner Logic
  useEffect(() => {
    let html5QrCode;
    
    if (isScannerModalOpen && isScanning && scanSessionId) {
      html5QrCode = new Html5Qrcode("qr-reader");
      
      html5QrCode.start(
        { facingMode: "environment" }, // Prefer back camera
        {
          fps: 5,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // Check if it's already paused/stopped to prevent multiple rapid scans
          if (html5QrCode.getState() === 2) { // 2 = SCANNING
            html5QrCode.pause(true); // pause scanning momentarily
            try {
              const res = await api.post('/asisten/absensi/qr', {
                sesiId: scanSessionId,
                qrToken: decodedText
              });
              setScanMessage({ type: 'success', text: res.message || 'Attendance recorded.' });
            } catch (err) {
              setScanMessage({ type: 'error', text: err.message || 'Failed to record attendance.' });
            }
            
            // Resume scanning after 2.5 seconds
            setTimeout(() => {
              setScanMessage(null);
              if (html5QrCode && html5QrCode.getState() === 3) { // 3 = PAUSED
                html5QrCode.resume();
              }
            }, 2500);
          }
        },
        (errorMessage) => {
          // Ignore general scan errors (no QR found in frame)
        }
      ).catch((err) => {
        setScanMessage({ type: 'error', text: 'Failed to access camera. Please ensure camera permissions are granted.' });
        console.error("Camera start error:", err);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(console.error);
      }
    };
  }, [isScannerModalOpen, isScanning, scanSessionId]);

  const handleCloseScanner = () => {
    setIsScannerModalOpen(false);
    setIsScanning(false);
    setScanSessionId('');
    setScanMessage(null);
    if (selectedKelasId) {
      fetchAttendanceData(selectedKelasId); // Refresh data when closed
    }
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
          <p className="page-subtitle">Monitor student attendance logs and override individual attendance statuses</p>
        </div>
        <div className="flex gap-3">
          {selectedKelasId && students.length > 0 && sessions.length > 0 && (
            <>
              <button className="btn btn-outline" onClick={() => setIsScannerModalOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <rect x="7" y="7" width="3" height="3" />
                  <rect x="14" y="7" width="3" height="3" />
                  <rect x="7" y="14" width="3" height="3" />
                  <rect x="14" y="14" width="3" height="3" />
                </svg>
                Scan QR
              </button>
              <button className="btn btn-ghost" onClick={handleExportExcel}>
                Export to Excel
              </button>
            </>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="absensi-controls" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
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
                    {c.namaKelas} - {c.mataKuliah?.nama}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {Object.keys(pendingChanges).length > 0 && (
            <div style={{ paddingBottom: '2px' }}>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handleSaveAll} 
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                {loading ? 'Saving...' : `Save ${Object.keys(pendingChanges).length} Changes`}
              </button>
            </div>
          )}
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
              <strong>Notice:</strong> Sesi absensi terbuat secara otomatis saat Admin melakukan <strong>Verify Semester</strong> di halaman jadwal untuk jadwal yang terkait kelas ini.
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

      {/* QR SCANNER MODAL */}
      {isScannerModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">QR Attendance Scanner</h3>
              <button className="modal-close" onClick={handleCloseScanner}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="login-form">
              <div style={{ fontSize: '13px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.5 }}>
                Please select a session first. Once selected, click "Start Camera" to begin scanning student QR codes.
              </div>

              {!isScanning && (
                <div className="form-group">
                  <label className="form-label">Session</label>
                  <select 
                    className="form-select" 
                    value={scanSessionId} 
                    onChange={(e) => setScanSessionId(e.target.value)}
                  >
                    <option value="">-- Select Session --</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        Session {s.pertemuanKe} ({formatDateDisplay(s.tanggal)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scanMessage && (
                <div className={`alert alert-${scanMessage.type} mb-4`} style={{ fontSize: '14px', textAlign: 'center', padding: '12px' }}>
                  {scanMessage.text}
                </div>
              )}

              {isScanning ? (
                <div className="scanner-container" style={{ marginTop: '20px' }}>
                  <div id="qr-reader" style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--hairline-strong)' }}></div>
                  <div className="flex-center mt-4" style={{ display: 'flex', justifyContent: 'center' }}>
                    <button type="button" className="btn btn-outline" onClick={() => { setIsScanning(false); setScanMessage(null); }}>
                      Stop Camera
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button type="button" className="btn btn-ghost" onClick={handleCloseScanner}>
                    Close
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    disabled={!scanSessionId}
                    onClick={() => setIsScanning(true)}
                  >
                    Start Camera
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
