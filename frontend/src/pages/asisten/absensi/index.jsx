import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './absensi.css';

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
        // Set default to the latest active session
        const active = data.find(s => !s.ditutupPada);
        if (active) setSelectedSesiId(active.id);
        else setSelectedSesiId(data[0].id);
      }
    } catch (err) {
      setError('Gagal mengambil daftar sesi');
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
      setError(err.message || 'Gagal memuat peserta sesi');
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
          // Play a small sound if possible, or trigger success
          const res = await api.post('/asisten/absensi/qr', {
            sesiId: selectedSesiId,
            qrToken: decodedText
          });
          setSuccess(res.message || 'QR code berhasil discan!');
          fetchSessionDetails(selectedSesiId);
        } catch (err) {
          setError(err.message || 'QR Code gagal diproses');
        }
      }, (err) => {
        // Silent error
      });

      scannerRef.current = scanner;
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => {});
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => {});
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
        keterangan: 'Dicatat manual oleh asisten'
      });
      setSuccess('Absensi berhasil diperbarui');
      fetchSessionDetails(selectedSesiId);
    } catch (err) {
      setError(err.message || 'Gagal mengubah absensi');
    }
  };

  const activeSesi = sesiList.find(s => s.id === parseInt(selectedSesiId));
  const isSessionClosed = sessionInfo?.ditutupPada !== null;

  return (
    <DashboardLayout title="Presensi Praktikum">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Absensi & Scanner QR</h1>
          <p className="page-subtitle">Rekam kehadiran praktikan melalui kamera scanner atau kontrol manual</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="form-select" 
            style={{ width: '240px' }}
            value={selectedSesiId} 
            onChange={(e) => setSelectedSesiId(e.target.value)}
          >
            <option value="">-- Pilih Sesi Pertemuan --</option>
            {sesiList.map(s => (
              <option key={s.id} value={s.id}>
                Pertemuan #{s.pertemuanKe} - {s.jadwal?.mataKuliah?.nama}
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
            <div className="empty-state-icon">📷</div>
            <p>Silakan pilih sesi praktikum terlebih dahulu untuk memulai absensi</p>
          </div>
        </div>
      ) : (
        <div className="absensi-container">
          {/* Kiri: QR Scanner */}
          <div className="scanner-box">
            <h3 style={{ fontSize: '18px', marginBottom: '8px', textAlign: 'center' }}>QR Code Scanner</h3>
            <p className="text-muted text-center mb-6" style={{ fontSize: '12px' }}>
              Minta praktikan menunjukkan QR dari aplikasi mereka
            </p>

            {isSessionClosed ? (
              <div className="alert alert-warning text-center" style={{ fontSize: '13px' }}>
                🔒 Sesi ini sudah ditutup. Scanner dinonaktifkan.
              </div>
            ) : (
              <div>
                {/* Element reader selalu ada di DOM agar tidak terjadi race condition mounting */}
                <div className="scanner-container mb-4" style={{ display: scannerActive ? 'block' : 'none' }}>
                  <div id="reader" />
                </div>

                {!scannerActive && (
                  <div className="scanner-container flex-center mb-4" style={{ height: '240px', background: 'var(--surface-soft)' }}>
                    <span style={{ fontSize: '48px', opacity: 0.3 }}>📷</span>
                  </div>
                )}

                <button 
                  className={`btn ${scannerActive ? 'btn-danger' : 'btn-primary'}`} 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setScannerActive(!scannerActive)}
                >
                  {scannerActive ? '⏹ Matikan Kamera' : '🎥 Aktifkan Kamera Scanner'}
                </button>
              </div>
            )}
            
            {sessionInfo && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--hairline)', paddingTop: '16px' }}>
                <div className="text-label" style={{ marginBottom: '8px' }}>Rincian Sesi</div>
                <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                  <div><strong>Topik:</strong> {sessionInfo.topik}</div>
                  <div><strong>Tanggal:</strong> {new Date(sessionInfo.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div><strong>Pertemuan:</strong> Ke-{sessionInfo.pertemuanKe}</div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span className={`badge ${isSessionClosed ? 'badge-alpa' : 'badge-hadir'}`}>
                      {isSessionClosed ? 'Ditutup' : 'Terbuka / Aktif'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Kanan: Daftar Mahasiswa & Absensi Manual */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Daftar Kehadiran Praktikan</h3>
              <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
                Total: {peserta.length} Mahasiswa
              </div>
            </div>

            {loading ? (
              <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
            ) : peserta.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👨‍🎓</div>
                <p>Tidak ada mahasiswa terdaftar di jadwal kelas ini</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Mahasiswa</th>
                      <th>Stambuk</th>
                      <th>Metode</th>
                      <th>Waktu Absen</th>
                      <th>Status Absen</th>
                      <th>Ubah Status</th>
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
                            <span className="badge badge-admin" style={{ textTransform: 'capitalize' }}>
                              {p.absensi.metode === 'qr_scan' ? '📱 QR Code' : '✍️ Manual'}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="text-mono" style={{ fontSize: '12px' }}>
                          {p.absensi?.waktuAbsen ? (
                            new Date(p.absensi.waktuAbsen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${p.absensi?.status || 'alpa'}`}>
                            {p.absensi?.status || 'Alpa'}
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
                                  {st}
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
