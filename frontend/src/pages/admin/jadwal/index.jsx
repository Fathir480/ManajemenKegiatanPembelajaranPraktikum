import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './jadwal.css';

const sessions = [
  { id: 1, name: 'Sesi 1', time: '07:00 - 09:30', jamMulai: '07:00', jamSelesai: '09:30' },
  { id: 2, name: 'Sesi 2', time: '09:40 - 12:10', jamMulai: '09:40', jamSelesai: '12:10' },
  { id: 3, name: 'Sesi 3', time: '13:00 - 15:30', jamMulai: '13:00', jamSelesai: '15:30' },
  { id: 4, name: 'Sesi 4', time: '15:40 - 18:10', jamMulai: '15:40', jamSelesai: '18:10' }
];

const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const classOptions = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

export default function KelolaJadwal() {
  const [jadwal, setJadwal] = useState([]);
  const [matkul, setMatkul] = useState([]);
  const [asisten, setAsisten] = useState([]);
  const [ruangan, setRuangan] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    mataKuliahId: '',
    asisenId: '',
    ruanganId: '',
    hari: 'Senin',
    sesi: '1',
    jamMulai: '07:00',
    jamSelesai: '09:30',
    semester: '2024/2025 Genap',
    kapasitasGrup: 30,
    kelas: 'A1'
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [jadwalData, matkulData, asistenData, ruanganData] = await Promise.all([
        api.get('/admin/jadwal'),
        api.get('/admin/matkul'),
        api.get('/admin/asisten'),
        api.get('/admin/ruangan')
      ]);
      setJadwal(jadwalData);
      setMatkul(matkulData.filter(m => m.aktif));
      setAsisten(asistenData);
      setRuangan(ruanganData);
    } catch (err) {
      setError(err.message || 'Gagal mengambil data penjadwalan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({
      mataKuliahId: '',
      asisenId: '',
      ruanganId: '',
      hari: 'Senin',
      sesi: '1',
      jamMulai: '07:00',
      jamSelesai: '09:30',
      semester: '2024/2025 Genap',
      kapasitasGrup: 30,
      kelas: 'A1'
    });
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'sesi') {
      const selectedSesi = sessions.find(s => String(s.id) === value);
      if (selectedSesi) {
        setFormData(prev => ({
          ...prev,
          sesi: value,
          jamMulai: selectedSesi.jamMulai,
          jamSelesai: selectedSesi.jamSelesai
        }));
        return;
      }
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const res = await api.post('/admin/jadwal', formData);
      setSuccess(res.message || 'Jadwal praktikum berhasil ditambahkan');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menambahkan jadwal');
    }
  };

  const handleExportExcel = () => {
    const headers = ['Sesi / Waktu', ...days];
    const rows = sessions.map(sesi => {
      const rowData = [`${sesi.name} (${sesi.time})`];
      days.forEach(day => {
        const cellJadwal = jadwal.filter(j => 
          j.hari === day && 
          ((j.jamMulai === sesi.jamMulai) || (j.jamMulai >= sesi.jamMulai && j.jamMulai < sesi.jamSelesai))
        );
        if (cellJadwal.length > 0) {
          const text = cellJadwal.map(j => 
            `[${j.mataKuliah?.kode}] ${j.mataKuliah?.nama}\nKelas: ${j.kelas || '-'}\nLab: ${j.ruangan?.nama || '-'}\nAsisten: ${j.asisten?.user?.nama || '-'}`
          ).join('\n\n');
          rowData.push(text);
        } else {
          rowData.push('');
        }
      });
      return rowData;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Set column widths and enable text wrap
    const wscols = [
      { wch: 22 }, // Sesi
      { wch: 32 }, // Senin
      { wch: 32 }, // Selasa
      { wch: 32 }, // Rabu
      { wch: 32 }, // Kamis
      { wch: 32 }, // Jumat
      { wch: 32 }  // Sabtu
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jadwal Mingguan');
    XLSX.writeFile(workbook, 'Matriks_Jadwal_Praktikum.xlsx');
  };

  const filteredJadwal = jadwal.filter(j => 
    j.mataKuliah?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.mataKuliah?.kode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.asisten?.user?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.hari?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.kelas?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Jadwal Praktikum">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Jadwal Praktikum</h1>
          <p className="page-subtitle">Kelola jam sesi lab, pembagian asisten, pembagian kelas, dan pencegahan bentrok jadwal</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={handleExportExcel}>
            📊 Ekspor Matriks (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            ➕ Buat Jadwal Baru
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

      <div className="card mb-6">
        <div className="jadwal-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div className="search-wrapper" style={{ position: 'relative', width: '320px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}>🔍</span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Cari matkul, asisten, kelas, hari..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>
          
          <div className="toggle-view-buttons" style={{ display: 'flex', background: 'var(--bg-muted)', padding: '4px', borderRadius: 'var(--radius-md)', gap: '4px' }}>
            <button 
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setViewMode('grid')}
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              📅 Grid Matriks Excel
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setViewMode('table')}
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              📋 Daftar Tabel
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Membuat tampilan penjadwalan...</span>
          </div>
        ) : viewMode === 'grid' ? (
          /* MATRIX GRID VIEW */
          <div className="table-wrapper matrix-wrapper" style={{ overflowX: 'auto' }}>
            <table className="matrix-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '150px', background: 'var(--surface-strong)', color: 'var(--ink)' }}>Sesi / Hari</th>
                  {days.map(day => (
                    <th key={day} style={{ minWidth: '200px', textAlign: 'center', background: 'var(--surface-strong)', color: 'var(--ink)' }}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map(sesi => (
                  <tr key={sesi.id}>
                    <td className="matrix-sesi-cell">
                      <div className="sesi-name">{sesi.name}</div>
                      <div className="sesi-time">{sesi.time}</div>
                    </td>
                    {days.map(day => {
                      // Filter schedules in this slot matching search criteria
                      const cellSchedules = filteredJadwal.filter(j => 
                        j.hari === day && 
                        ((j.jamMulai === sesi.jamMulai) || (j.jamMulai >= sesi.jamMulai && j.jamMulai < sesi.jamSelesai))
                      );

                      return (
                        <td key={day} className="matrix-slot-cell" style={{ verticalAlign: 'top', height: '120px' }}>
                          <div className="matrix-cards-container">
                            {cellSchedules.length > 0 ? (
                              cellSchedules.map(j => {
                                // Assign gradient based on class or course code
                                const classCode = j.kelas || 'A1';
                                const hue = (classCode.charCodeAt(0) * 15 + parseInt(classCode.substring(1) || '1') * 45) % 360;
                                const borderStyle = {
                                  borderLeft: `4px solid hsl(${hue}, 70%, 55%)`,
                                  background: `hsla(${hue}, 60%, 95%, 0.45)`
                                };

                                return (
                                  <div key={j.id} className="matrix-card" style={borderStyle}>
                                    <div className="matrix-card-header">
                                      <span className="matrix-card-code">{j.mataKuliah?.kode}</span>
                                      <span className="matrix-card-class">Kelas {j.kelas || '-'}</span>
                                    </div>
                                    <div className="matrix-card-title">{j.mataKuliah?.nama}</div>
                                    <div className="matrix-card-details">
                                      <div className="matrix-detail-item">🔑 {j.ruangan?.nama || 'Lab TBD'}</div>
                                      <div className="matrix-detail-item">👤 {j.asisten?.user?.nama || 'Tanpa Asisten'}</div>
                                      <div className="matrix-detail-item">👥 {j.kapasitasGrup} Mhs Max</div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="matrix-empty-slot">Kosong</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* STANDARD TABLE LIST VIEW */
          filteredJadwal.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🗓️</div>
              <p>Tidak ada jadwal ditemukan</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mata Kuliah / Praktikum</th>
                    <th>Asisten Bertugas</th>
                    <th>Hari & Jam</th>
                    <th>Kelas</th>
                    <th>Ruangan</th>
                    <th>Kapasitas</th>
                    <th>Semester</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJadwal.map(j => (
                    <tr key={j.id}>
                      <td>
                        <strong>{j.mataKuliah?.nama}</strong>
                        <br />
                        <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {j.mataKuliah?.kode}
                        </span>
                      </td>
                      <td>
                        {j.asisten ? (
                          <div>
                            <strong>{j.asisten.user?.nama}</strong>
                            <br />
                            <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {j.asisten.stambuk}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">Belum ada asisten</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-hadir" style={{ marginRight: '8px' }}>
                          {j.hari}
                        </span>
                        <span className="text-mono">
                          {j.jamMulai} - {j.jamSelesai}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-admin" style={{ fontWeight: 600 }}>
                          {j.kelas || '-'}
                        </span>
                      </td>
                      <td>{j.ruangan?.nama || '-'}</td>
                      <td>{j.kapasitasGrup} mhs</td>
                      <td className="text-mono" style={{ fontSize: '12px' }}>{j.semester}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* modal add */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Buat Jadwal Baru</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Mata Kuliah / Praktikum</label>
                <select 
                  name="mataKuliahId" 
                  className="form-select" 
                  required
                  value={formData.mataKuliahId} 
                  onChange={handleFormChange}
                >
                  <option value="" disabled>-- Pilih Mata Kuliah --</option>
                  {matkul.map(m => (
                    <option key={m.id} value={m.id}>{m.kode} - {m.nama}</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Asisten Bertugas (Opsional)</label>
                  <select 
                    name="asisenId" 
                    className="form-select" 
                    value={formData.asisenId} 
                    onChange={handleFormChange}
                  >
                    <option value="">-- Pilih Asisten --</option>
                    {asisten.map(a => (
                      <option key={a.id} value={a.id}>{a.user?.nama} ({a.stambuk})</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Ruangan Lab (Opsional)</label>
                  <select 
                    name="ruanganId" 
                    className="form-select" 
                    value={formData.ruanganId} 
                    onChange={handleFormChange}
                  >
                    <option value="">-- Pilih Ruangan --</option>
                    {ruangan.map(r => (
                      <option key={r.id} value={r.id}>{r.nama} (Kap: {r.kapasitas})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Hari</label>
                  <select 
                    name="hari" 
                    className="form-select" 
                    required
                    value={formData.hari} 
                    onChange={handleFormChange}
                  >
                    <option value="Senin">Senin</option>
                    <option value="Selasa">Selasa</option>
                    <option value="Rabu">Rabu</option>
                    <option value="Kamis">Kamis</option>
                    <option value="Jumat">Jumat</option>
                    <option value="Sabtu">Sabtu</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Pilih Sesi Praktikum</label>
                  <select 
                    name="sesi" 
                    className="form-select" 
                    required
                    value={formData.sesi} 
                    onChange={handleFormChange}
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.time})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Jam Mulai</label>
                  <input 
                    type="text" 
                    name="jamMulai" 
                    className="form-input" 
                    required 
                    readOnly
                    style={{ background: 'var(--bg-muted)', cursor: 'not-allowed' }}
                    value={formData.jamMulai} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Jam Selesai</label>
                  <input 
                    type="text" 
                    name="jamSelesai" 
                    className="form-input" 
                    required 
                    readOnly
                    style={{ background: 'var(--bg-muted)', cursor: 'not-allowed' }}
                    value={formData.jamSelesai} 
                  />
                </div>
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Kelas</label>
                  <select
                    name="kelas"
                    className="form-select"
                    required
                    value={formData.kelas}
                    onChange={handleFormChange}
                  >
                    {classOptions.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Kapasitas Grup</label>
                  <input 
                    type="number" 
                    name="kapasitasGrup" 
                    className="form-input" 
                    required 
                    min="1"
                    value={formData.kapasitasGrup} 
                    onChange={handleFormChange} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <input 
                    type="text" 
                    name="semester" 
                    className="form-input" 
                    required 
                    value={formData.semester} 
                    onChange={handleFormChange} 
                  />
                </div>
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
