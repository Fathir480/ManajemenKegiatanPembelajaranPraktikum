import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './absensi.css';

const dayMap = {
  'Senin': 'Monday',
  'Selasa': 'Tuesday',
  'Rabu': 'Wednesday',
  'Kamis': 'Thursday',
  'Jumat': 'Friday',
  'Sabtu': 'Saturday',
  'Minggu': 'Sunday'
};

const statusMap = {
  'hadir': 'Present',
  'izin': 'Excused',
  'sakit': 'Sick',
  'alpa': 'Absent'
};

export default function AsistenAbsensi() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialSesiId = queryParams.get('sesi') || '';
  
  const [sesiList, setSesiList] = useState([]);
  const [selectedSesiId, setSelectedSesiId] = useState(initialSesiId);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [peserta, setPeserta] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Scanner State
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);

  const fetchSessions = async () => {
    try {
      const data = await api.get('/asisten/sesi');
      setSesiList(data);
      if (!selectedSesiId && data.length > 0) {
        const active = data.find(s => !s.ditutupPada);
        if (active) setSelectedSesiId(active.id);
        else setSelectedSesiId(data[0].id);
      }
    } catch (err) {
      setError('Failed to fetch session list');
    }
  };

  const fetchSessionDetails = async (id) => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/asisten/sesi/${id}/peserta`);
      setSessionInfo(data.sesi);
      setPeserta(data.peserta);
    } catch (err) {
      setError(err.message || 'Failed to load session participants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSesiId) {
      fetchSessionDetails(selectedSesiId);
    } else {
      setSessionInfo(null);
      setPeserta([]);
    }
  }, [selectedSesiId]);

  // QR Code Scanner Initialization
  useEffect(() => {
    if (scannerActive && selectedSesiId) {
      const scanner = new Html5QrcodeScanner('reader', {
        fps: 10,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1.0
      }, false);

      scanner.render(async (decodedText) => {
        try {
          setError('');
          setSuccess('');
          const res = await api.post('/asisten/absensi/qr', {
            sesiId: selectedSesiId,
            qrToken: decodedText
          });
          setSuccess(res.message || 'QR code successfully scanned!');
          fetchSessionDetails(selectedSesiId);
        } catch (err) {
          setError(err.message || 'Failed to process QR Code');
        }
      }, () => {
        // Silent error
      });

      scannerRef.current = scanner;
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [scannerActive, selectedSesiId]);

  const handleManualAbsensi = async (mahasiswaId, status) => {
    setError('');
    setSuccess('');
    try {
      await api.post('/asisten/absensi/manual', {
        sesiId: selectedSesiId,
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

  const isSessionClosed = sessionInfo?.ditutupPada !== null;

  return (
    <DashboardLayout title="Practicum Attendance">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Attendance & QR Scanner</h1>
          <p className="page-subtitle">Record student attendance via camera scanner or manual control</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="form-select" 
            style={{ width: '280px' }}
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
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      {!selectedSesiId ? (
        <div className="card">
          <div className="empty-state">
            <p>Please select a session first to begin attendance registration</p>
          </div>
        </div>
      ) : (
        <div className="absensi-container">
          {/* Left: QR Scanner */}
          <div className="scanner-box" style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '8px', textAlign: 'center' }}>QR Code Scanner</h3>
            <p className="text-muted text-center mb-6" style={{ fontSize: '12px' }}>
              Ask student to display their dynamic QR Code
            </p>

            {isSessionClosed ? (
              <div className="alert alert-warning text-center" style={{ fontSize: '13px', border: '1px solid var(--hairline-strong)' }}>
                This session is closed. Scanner is disabled.
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
                  <div><strong>Topic:</strong> {sessionInfo.topik}</div>
                  <div><strong>Date:</strong> {new Date(sessionInfo.tanggal).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div><strong>Session Number:</strong> #{sessionInfo.pertemuanKe}</div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span className={`badge ${isSessionClosed ? 'badge-status-inactive' : 'badge-status-active'}`}>
                      {isSessionClosed ? 'Closed' : 'Active / Open'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Students Table & Manual Attendance */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Student Attendance List</h3>
              <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
                Total: {peserta.length} Students
              </div>
            </div>

            {loading ? (
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
    </DashboardLayout>
  );
}
