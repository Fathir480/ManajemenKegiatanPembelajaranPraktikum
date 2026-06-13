import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import '../../admin/absensi/absensi.css'; // Matrix styles
import './absensi.css'; // Scanner styles

const statusMap = {
  'hadir': 'Present',
  'izin': 'Excused',
  'sakit': 'Sick',
  'alpa': 'Absent'
};

export default function AsistenAbsensi() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialSesiId = queryParams.get('sesi') || '';

  // Tab State
  const [activeTab, setActiveTab] = useState(initialSesiId ? 'scanner' : 'matrix');

  // Shared / Universal States
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── RECAP MATRIX STATE ──────────────────────────────────
  const [classes, setClasses] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Date Modal State
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [modalError, setModalError] = useState('');

  // ── SESSION MANAGER MODAL STATE ──────────────────────────
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [startingSesiId, setStartingSesiId] = useState(null);
  const [startingTopic, setStartingTopic] = useState('');

  // ── SCANNER STATE ──────────────────────────────────────
  const [sesiList, setSesiList] = useState([]);
  const [selectedSesiId, setSelectedSesiId] = useState(initialSesiId);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [peserta, setPeserta] = useState([]);
  const [loadingScanner, setLoadingScanner] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [inlineTopicInput, setInlineTopicInput] = useState('');

  // ── EFFECTS & FETCHING ─────────────────────────────────

  const fetchSessions = async () => {
    try {
      const sessionsData = await api.get('/asisten/sesi');
      setSesiList(sessionsData);
      return sessionsData;
    } catch (err) {
      console.error('Failed to fetch session list', err);
    }
  };

  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const classesData = await api.get('/asisten/kelas');
      setClasses(classesData);
      if (classesData.length > 0) {
        setSelectedKelasId(String(classesData[0].id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load assigned classes.');
    } finally {
      setLoadingClasses(false);
    }
  };

  // On mount, load general classes (for Matrix) and sessions list (for Scanner)
  useEffect(() => {
    fetchClasses();
    fetchSessions().then(sessionsData => {
      if (!selectedSesiId && sessionsData && sessionsData.length > 0) {
        const active = sessionsData.find(s => !s.ditutupPada);
        if (active) setSelectedSesiId(String(active.id));
        else setSelectedSesiId(String(sessionsData[0].id));
      }
    });
  }, []);

  // Fetch Matrix Data when class selection changes
  const fetchAttendanceData = async (kelasId) => {
    try {
      setLoadingMatrix(true);
      setError('');
      setSuccess('');
      const data = await api.get(`/asisten/absensi/kelas/${kelasId}`);
      setStudents(data.students || []);
      setSessions(data.sessions || []);
      setAttendance(data.attendance || []);
    } catch (err) {
      setError(err.message || 'Failed to load class attendance data.');
    } finally {
      setLoadingMatrix(false);
    }
  };

  useEffect(() => {
    if (selectedKelasId && activeTab === 'matrix') {
      fetchAttendanceData(selectedKelasId);
    }
  }, [selectedKelasId, activeTab]);

  // Fetch Scanner Session Details
  const fetchSessionDetails = async (id) => {
    if (!id) return;
    try {
      setLoadingScanner(true);
      setError('');
      const data = await api.get(`/asisten/sesi/${id}/peserta`);
      setSessionInfo(data.sesi);
      setPeserta(data.peserta);
    } catch (err) {
      setError(err.message || 'Failed to load session participants');
    } finally {
      setLoadingScanner(false);
    }
  };

  useEffect(() => {
    if (selectedSesiId && activeTab === 'scanner') {
      fetchSessionDetails(selectedSesiId);
    } else {
      setSessionInfo(null);
      setPeserta([]);
    }
  }, [selectedSesiId, activeTab]);

  // ── MATRIX ACTIONS ─────────────────────────────────────
  
  const handleKelasChange = (e) => {
    setSelectedKelasId(e.target.value);
  };

  const getAttendanceStatus = (studentId, sessionId) => {
    const record = attendance.find(a => a.mahasiswaId === studentId && a.sesiId === sessionId);
    return record ? record.status : 'alpa';
  };

  const handleStatusChange = async (studentId, sessionId, newStatus) => {
    try {
      setError('');
      setSuccess('');
      await api.put('/asisten/absensi/update', {
        sesiId: sessionId,
        mahasiswaId: studentId,
        status: newStatus
      });

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

  const openDateModal = (session) => {
    setEditingSession(session);
    const dateStr = session.tanggal ? new Date(session.tanggal).toISOString().split('T')[0] : '';
    setNewDate(dateStr);
    setModalError('');
    setIsDateModalOpen(true);
  };

  const handleDateSubmit = async (e) => {
    e.preventDefault();
    if (!newDate) {
      setModalError('Please select a valid date.');
      return;
    }
    try {
      setModalError('');
      const res = await api.put(`/asisten/absensi/sesi/${editingSession.id}`, { tanggal: newDate });
      
      setSessions(prev => 
        prev.map(s => s.id === editingSession.id ? { ...s, tanggal: res.updatedSesi.tanggal } : s)
      );

      setSuccess('Session date updated successfully.');
      setIsDateModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'Failed to update session date.');
    }
  };

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

  // ── SCANNER ACTIONS ────────────────────────────────────

  // QR Code Scanner Effect
  useEffect(() => {
    let html5QrCode = null;
    const isSessionActive = sessionInfo?.dibukaPada && !sessionInfo?.ditutupPada;

    if (scannerActive && selectedSesiId && activeTab === 'scanner' && isSessionActive) {
      html5QrCode = new Html5Qrcode("reader");

      html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        async (decodedText) => {
          try {
            setError('');
            setSuccess('');
            const res = await api.post('/asisten/absensi/qr', {
              sesiId: parseInt(selectedSesiId),
              qrToken: decodedText
            });
            setSuccess(res.message || 'QR code successfully scanned!');
            fetchSessionDetails(selectedSesiId);
          } catch (err) {
            setError(err.message || 'Failed to process QR Code');
          }
        },
        () => {
          // Silent scan error
        }
      ).catch((err) => {
        console.error("Gagal menyalakan kamera:", err);
        setError("Gagal mengakses kamera. Pastikan izin sudah diberikan.");
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch((err) => {
          console.error("Gagal mematikan kamera:", err);
        });
      }
    };
  }, [scannerActive, selectedSesiId, activeTab, sessionInfo]);

  const handleManualAbsensi = async (mahasiswaId, status) => {
    setError('');
    setSuccess('');
    try {
      await api.post('/asisten/absensi/manual', {
        sesiId: parseInt(selectedSesiId),
        mahasiswaId,
        status,
        keterangan: 'Recorded manually by assistant'
      });
      setSuccess('Attendance successfully updated');
      fetchSessionDetails(selectedSesiId);
    } catch (err) {
      setError(err.message || 'Failed to update attendance');
    }
  };

  const handleStartSession = async (sesiId, topic) => {
    if (!topic) return alert('Session topic is required.');
    try {
      setError('');
      setSuccess('');
      const res = await api.put(`/asisten/sesi/${sesiId}/buka`, { topik: topic });
      setSuccess('Session started and scanner opened.');
      
      // Reset form variables
      setStartingSesiId(null);
      setStartingTopic('');
      setInlineTopicInput('');

      // Refresh data
      await fetchSessions();
      if (selectedKelasId) await fetchAttendanceData(selectedKelasId);

      // Select started session and switch to scanner tab
      setSelectedSesiId(String(res.data.id));
      setActiveTab('scanner');
      setIsScannerModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to start session.');
    }
  };

  const handleCloseSession = async (sesiId) => {
    if (!window.confirm('Are you sure you want to close this session? Once closed, attendance registration ends.')) return;
    try {
      setError('');
      setSuccess('');
      await api.put(`/asisten/sesi/${sesiId}/tutup`);
      setSuccess('Session successfully closed.');
      
      await fetchSessions();
      if (selectedKelasId) await fetchAttendanceData(selectedKelasId);
      
      if (selectedSesiId === String(sesiId)) {
        fetchSessionDetails(selectedSesiId);
      }
    } catch (err) {
      setError(err.message || 'Failed to close session.');
    }
  };

  const isSessionClosed = sessionInfo?.ditutupPada !== null;
  const isSessionStarted = sessionInfo?.dibukaPada !== null;

  return (
    <DashboardLayout title="Class Attendance (Assistant)">
      {/* Tab Selectors */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--hairline-strong)', marginBottom: '24px' }}>
        <button
          onClick={() => { setActiveTab('matrix'); setError(''); setSuccess(''); }}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            color: activeTab === 'matrix' ? 'var(--pacific-blue)' : 'var(--muted)',
            fontWeight: activeTab === 'matrix' ? 600 : 400,
            borderBottom: activeTab === 'matrix' ? '2px solid var(--pacific-blue)' : 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'var(--font-sans)'
          }}
        >
          Recap Matrix
        </button>
        <button
          onClick={() => { setActiveTab('scanner'); setError(''); setSuccess(''); }}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            color: activeTab === 'scanner' ? 'var(--pacific-blue)' : 'var(--muted)',
            fontWeight: activeTab === 'scanner' ? 600 : 400,
            borderBottom: activeTab === 'scanner' ? '2px solid var(--pacific-blue)' : 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'var(--font-sans)'
          }}
        >
          QR Scanner & Manual Check-in
        </button>
      </div>

      {/* HEADER SECTION */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>
            {activeTab === 'matrix' ? 'Practical Course Attendance' : 'Attendance & QR Scanner'}
          </h1>
          <p className="page-subtitle">
            {activeTab === 'matrix' 
              ? 'Monitor student attendance logs, modify session dates, and override individual attendance statuses'
              : 'Record student attendance via camera scanner or manual control'
            }
          </p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'matrix' && selectedKelasId && (
            <button className="btn btn-primary" onClick={() => setIsScannerModalOpen(true)}>
              Open Scanner
            </button>
          )}
          {activeTab === 'matrix' && selectedKelasId && students.length > 0 && sessions.length > 0 && (
            <button className="btn btn-ghost" onClick={handleExportExcel}>
              Export to Excel
            </button>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      {/* ── MATRIX VIEW ────────────────────────────────────── */}
      {activeTab === 'matrix' && (
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

          {loadingMatrix ? (
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
                <strong>Notice:</strong> Sesi absensi terbuat secara otomatis saat semester diverifikasi oleh Admin.
              </div>
            </div>
          ) : (
            <div className="table-wrapper absensi-matrix-wrapper" style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table className="absensi-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '260px', minWidth: '260px', textAlign: 'left', background: 'var(--surface-strong)', color: 'var(--ink)', position: 'sticky', left: 0, zIndex: 11 }}>
                      Student Name / NIM
                    </th>
                    {sessions.map(s => (
                      <th key={s.id} style={{ minWidth: '110px', textAlign: 'center', background: 'var(--surface-soft)', color: 'var(--ink)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <span className="text-mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                            {formatDateDisplay(s.tanggal)}
                          </span>
                          
                          {/* Edit Date Button */}
                          <button 
                            type="button" 
                            className="action-icon-btn action-edit"
                            onClick={() => openDateModal(s)}
                            style={{ padding: '2px', display: 'inline-flex' }}
                            title="Change Date"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          </button>

                          {/* Jump to QR Scanner Button */}
                          <button 
                            type="button" 
                            className="action-icon-btn action-edit"
                            onClick={() => {
                              setSelectedSesiId(String(s.id));
                              setActiveTab('scanner');
                            }}
                            style={{ padding: '2px', display: 'inline-flex', color: 'var(--pacific-blue)' }}
                            title="Open Scanner for this Session"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
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
      )}

      {/* ── SCANNER VIEW ───────────────────────────────────── */}
      {activeTab === 'scanner' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <select 
              className="form-select" 
              style={{ width: '320px' }}
              value={selectedSesiId} 
              onChange={(e) => setSelectedSesiId(e.target.value)}
            >
              <option value="">-- Select Pertemuan Session --</option>
              {sesiList.map(s => (
                <option key={s.id} value={s.id}>
                  Session #{s.pertemuanKe} - {s.jadwal?.mataKuliah?.nama}
                </option>
              ))}
            </select>
          </div>

          {!selectedSesiId ? (
            <div className="card">
              <div className="empty-state">
                <p>Please select a session first to begin attendance registration</p>
              </div>
            </div>
          ) : (
            <div className="absensi-container">
              {/* Left Column: QR Scanner */}
              <div className="scanner-box" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', padding: '24px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '8px', textAlign: 'center' }}>QR Code Scanner</h3>
                <p className="text-muted text-center mb-6" style={{ fontSize: '12px' }}>
                  Ask student to display their dynamic QR Code
                </p>

                {!isSessionStarted ? (
                  /* Form to Start Session directly inside Scanner tab if not started yet */
                  <div style={{ marginTop: '16px' }}>
                    <div className="alert alert-warning text-center" style={{ fontSize: '13px', border: '1px solid var(--hairline-strong)', marginBottom: '16px' }}>
                      This session has not been started yet. Please start it to enable QR Scanner.
                    </div>
                    <div className="form-group">
                      <label className="form-label">Session Topic</label>
                      <input 
                        type="text" 
                        className="form-input text-mono" 
                        value={inlineTopicInput}
                        onChange={(e) => setInlineTopicInput(e.target.value)}
                        placeholder="e.g. Introduction to React hooks"
                        style={{ fontSize: '12px' }}
                      />
                      <button 
                        className="btn btn-primary" 
                        style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
                        onClick={() => handleStartSession(selectedSesiId, inlineTopicInput)}
                      >
                        Start Session & Open Scanner
                      </button>
                    </div>
                  </div>
                ) : isSessionClosed ? (
                  <div className="alert alert-warning text-center" style={{ fontSize: '13px', border: '1px solid var(--hairline-strong)' }}>
                    This session is completed / closed. Scanner is disabled.
                  </div>
                ) : (
                  <div>
                    <div className="scanner-container mb-4" style={{ display: scannerActive ? 'block' : 'none' }}>
                      <div id="reader" />
                    </div>

                    {!scannerActive && (
                      <div className="scanner-container flex-center mb-4" style={{ height: '240px', background: 'var(--surface-soft)', border: '1px solid var(--hairline)' }}>
                        <span style={{ fontSize: '14px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Camera Off</span>
                      </div>
                    )}

                    <button 
                      className={`btn ${scannerActive ? 'btn-danger' : 'btn-primary'}`} 
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => setScannerActive(!scannerActive)}
                    >
                      {scannerActive ? 'Disable Camera' : 'Enable Scanner Camera'}
                    </button>
                  </div>
                )}
                
                {sessionInfo && (
                  <div style={{ marginTop: '24px', borderTop: '1px solid var(--hairline)', paddingTop: '16px' }}>
                    <div className="text-label" style={{ marginBottom: '8px' }}>Session Details</div>
                    <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                      <div><strong>Topic:</strong> {sessionInfo.topik || 'No specific topic'}</div>
                      <div><strong>Date:</strong> {new Date(sessionInfo.tanggal).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      <div><strong>Session Number:</strong> #{sessionInfo.pertemuanKe}</div>
                      <div>
                        <strong>Status:</strong>{' '}
                        <span className={`badge ${isSessionClosed ? 'badge-status-inactive' : !isSessionStarted ? 'badge-status-inactive' : 'badge-status-active'}`} style={{ textTransform: 'capitalize' }}>
                          {isSessionClosed ? 'Closed' : !isSessionStarted ? 'Not Started' : 'Active / Open'}
                        </span>
                      </div>

                      {/* Close Session Button directly in scanner card */}
                      {isSessionStarted && !isSessionClosed && (
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
                          onClick={() => handleCloseSession(selectedSesiId)}
                        >
                          Close Session / Stop Scanner
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Students Table & Manual Attendance */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Student Attendance List</h3>
                  <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
                    Total: {peserta.length} Students
                  </div>
                </div>

                {loadingScanner ? (
                  <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
                ) : peserta.length === 0 ? (
                  <div className="empty-state">
                    <p>No students registered for this class schedule</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Student ID</th>
                          <th>Method</th>
                          <th>Check-in Time</th>
                          <th>Status</th>
                          <th>Modify Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {peserta.map(p => (
                          <tr key={p.mahasiswaId}>
                            <td>
                              <strong>{p.nama}</strong>
                              <br />
                              <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                {p.email}
                              </span>
                            </td>
                            <td className="text-mono">{p.stambuk}</td>
                            <td>
                              {p.absensi ? (
                                <span className="badge badge-status-active">
                                  {p.absensi.metode === 'qr_scan' ? 'QR Code' : 'Manual'}
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className="text-mono" style={{ fontSize: '12px' }}>
                              {p.absensi?.waktuAbsen ? (
                                new Date(p.absensi.waktuAbsen).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${p.absensi?.status === 'hadir' ? 'badge-status-active' : 'badge-status-inactive'}`}>
                                {statusMap[p.absensi?.status || 'alpa']}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-2">
                                {['hadir', 'izin', 'sakit', 'alpa'].map(st => {
                                  const isCurrent = p.absensi?.status === st || (!p.absensi && st === 'alpa');
                                  return (
                                    <button
                                      key={st}
                                      className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-ghost'}`}
                                      disabled={!isSessionStarted} // Prevent overrides if session has not started yet
                                      style={{ 
                                        padding: '4px 8px', 
                                        height: 'auto', 
                                        fontSize: '10px',
                                        textTransform: 'capitalize',
                                        letterSpacing: 0
                                      }}
                                      onClick={() => handleManualAbsensi(p.mahasiswaId, st)}
                                    >
                                      {statusMap[st]}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DATE EDITING MODAL (MATRIX RECAP) */}
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

      {/* SESSION MANAGER MODAL (OPEN SCANNER) */}
      {isScannerModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '780px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Select Session to Scan / Start</h3>
              <button className="modal-close" onClick={() => {
                setIsScannerModalOpen(false);
                setStartingSesiId(null);
                setStartingTopic('');
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 0' }}>
              <div style={{ fontSize: '13px', color: 'var(--body)', marginBottom: '16px', padding: '0 24px', lineHeight: 1.5 }}>
                Berikut adalah daftar sesi praktikum untuk kelas ini. Sesi yang <strong>belum dimulai</strong> harus diaktifkan terlebih dahulu dengan memberikan topik bahasan sebelum dapat melakukan pemindaian QR.
              </div>

              <div className="table-wrapper" style={{ maxHeight: '380px', overflowY: 'auto', padding: '0 24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Pertemuan</th>
                      <th>Tanggal Sesi</th>
                      <th>Topik Bahasan</th>
                      <th>Status Sesi</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => {
                      const isNotStarted = !s.dibukaPada && !s.ditutupPada;
                      const isActive = s.dibukaPada && !s.ditutupPada;
                      const isClosed = !!s.ditutupPada;

                      return (
                        <tr key={s.id}>
                          <td className="text-mono" style={{ fontWeight: 600 }}>Pertemuan #{s.pertemuanKe}</td>
                          <td className="text-mono">{formatDateDisplay(s.tanggal)}</td>
                          <td>
                            {startingSesiId === s.id ? (
                              <input 
                                type="text" 
                                className="form-input text-mono" 
                                style={{ fontSize: '12px', padding: '4px 8px', width: '100%', minWidth: '180px' }}
                                placeholder="e.g. Basic HTML elements"
                                value={startingTopic}
                                onChange={(e) => setStartingTopic(e.target.value)}
                              />
                            ) : (
                              s.topik || <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            {isActive ? (
                              <span className="badge badge-status-active">Active</span>
                            ) : isClosed ? (
                              <span className="badge badge-status-inactive">Closed</span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>Not Started</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                              {isActive && (
                                <>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    style={{ padding: '6px 12px', height: 'auto', fontSize: '11px', fontWeight: 600 }}
                                    onClick={() => {
                                      setSelectedSesiId(String(s.id));
                                      setActiveTab('scanner');
                                      setIsScannerModalOpen(false);
                                    }}
                                  >
                                    Scan QR
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: '6px 12px', height: 'auto', fontSize: '11px', fontWeight: 600 }}
                                    onClick={() => handleCloseSession(s.id)}
                                  >
                                    Close
                                  </button>
                                </>
                              )}
                              {isClosed && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '6px 12px', height: 'auto', fontSize: '11px' }}
                                  onClick={() => {
                                    setSelectedSesiId(String(s.id));
                                    setActiveTab('scanner');
                                    setIsScannerModalOpen(false);
                                  }}
                                >
                                  View Scanner
                                </button>
                              )}
                              {isNotStarted && (
                                <>
                                  {startingSesiId === s.id ? (
                                    <>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        style={{ padding: '6px 12px', height: 'auto', fontSize: '11px', fontWeight: 600 }}
                                        onClick={() => handleStartSession(s.id, startingTopic)}
                                      >
                                        Start
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ padding: '6px 12px', height: 'auto', fontSize: '11px' }}
                                        onClick={() => {
                                          setStartingSesiId(null);
                                          setStartingTopic('');
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      style={{ padding: '6px 12px', height: 'auto', fontSize: '11px', fontWeight: 600 }}
                                      onClick={() => {
                                        setStartingSesiId(s.id);
                                        setStartingTopic(`Pertemuan ke-${s.pertemuanKe}`);
                                      }}
                                    >
                                      Start Session
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="modal-footer flex-end gap-3" style={{ padding: '16px 24px 0 24px', borderTop: '1px solid var(--hairline-strong)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => {
                  setIsScannerModalOpen(false);
                  setStartingSesiId(null);
                  setStartingTopic('');
                }}
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
