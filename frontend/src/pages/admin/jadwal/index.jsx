import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './jadwal.css';

const sessions = [
  { id: 1, name: 'Session 1', time: '07:00 - 09:30', jamMulai: '07:00', jamSelesai: '09:30' },
  { id: 2, name: 'Session 2', time: '09:40 - 12:10', jamMulai: '09:40', jamSelesai: '12:10' },
  { id: 3, name: 'Session 3', time: '13:00 - 15:30', jamMulai: '13:00', jamSelesai: '15:30' },
  { id: 4, name: 'Session 4', time: '15:40 - 18:10', jamMulai: '15:40', jamSelesai: '18:10' }
];

const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const dayIndoToEng = {
  'Senin': 'Monday',
  'Selasa': 'Tuesday',
  'Rabu': 'Wednesday',
  'Kamis': 'Thursday',
  'Jumat': 'Friday',
  'Sabtu': 'Saturday'
};

export default function KelolaJadwal() {
  const [jadwal, setJadwal] = useState([]);
  const [matkul, setMatkul] = useState([]);
  const [asisten, setAsisten] = useState([]);
  const [ruangan, setRuangan] = useState([]);
  const [dosen, setDosen] = useState([]);
  const [kelasDataList, setKelasDataList] = useState([]);
  
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
    dosenId: '',
    hari: 'Senin',
    sesi: '1',
    jamMulai: '07:00',
    jamSelesai: '09:30',
    kelasId: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [jadwalData, matkulData, asistenData, ruanganData, kelasData, dosenData] = await Promise.all([
        api.get('/admin/jadwal'),
        api.get('/admin/matkul'),
        api.get('/admin/asisten'),
        api.get('/admin/ruangan'),
        api.get('/admin/kelas'),
        api.get('/admin/dosen')
      ]);
      setJadwal(jadwalData);
      setMatkul(matkulData.filter(m => m.aktif));
      setAsisten(asistenData);
      setRuangan(ruanganData);
      setKelasDataList(kelasData);
      setDosen(dosenData);
    } catch (err) {
      setError(err.message || 'Failed to fetch scheduling data');
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
      dosenId: '',
      hari: 'Senin',
      sesi: '1',
      jamMulai: '07:00',
      jamSelesai: '09:30',
      kelasId: ''
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
    if (name === 'mataKuliahId') {
      setFormData(prev => ({
        ...prev,
        mataKuliahId: value,
        kelasId: '' // Reset selected class when course changes
      }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const res = await api.post('/admin/jadwal', formData);
      setSuccess(res.message || 'Practicum schedule successfully added');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to add schedule');
    }
  };

  const handleExportExcel = () => {
    const headers = ['Session / Time', ...days.map(day => dayIndoToEng[day] || day)];
    const rows = sessions.map(sesi => {
      const rowData = [`${sesi.name} (${sesi.time})`];
      days.forEach(day => {
        const cellJadwal = jadwal.filter(j => 
          j.hari === day && 
          ((j.jamMulai === sesi.jamMulai) || (j.jamMulai >= sesi.jamMulai && j.jamMulai < sesi.jamSelesai))
        );
        if (cellJadwal.length > 0) {
          const text = cellJadwal.map(j => 
            `[${j.mataKuliah?.kode}] ${j.mataKuliah?.nama}\nClass: ${j.kelas || '-'}\nLab: ${j.ruangan?.nama || '-'}\nLecturer: ${j.dosen?.user?.nama || '-'}\nAssistant: ${j.asisten?.user?.nama || '-'}`
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Weekly Schedule');
    XLSX.writeFile(workbook, 'Practicum_Schedule_Matrix.xlsx');
  };

  const filteredJadwal = jadwal.filter(j => 
    j.mataKuliah?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.mataKuliah?.kode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.asisten?.user?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.dosen?.user?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.hari?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dayIndoToEng[j.hari]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.kelas?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Practicum Schedule">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Practicum Schedule</h1>
          <p className="page-subtitle">Manage lab session hours, assistant assignments, class divisions, and schedule conflict prevention</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-ghost" onClick={handleExportExcel}>
            Export Matrix (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            Create New Schedule
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

      <div className="card mb-6">
        <div className="jadwal-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div className="search-wrapper" style={{ position: 'relative', width: '320px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '14px' }}></span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search course, assistant, class, day..." 
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
              Excel Grid Matrix
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setViewMode('table')}
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              Table List
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Building schedule view...</span>
          </div>
        ) : viewMode === 'grid' ? (
          /* MATRIX GRID VIEW */
          <div className="table-wrapper matrix-wrapper" style={{ overflowX: 'auto' }}>
            <table className="matrix-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '150px', background: 'var(--surface-strong)', color: 'var(--ink)' }}>Session / Day</th>
                  {days.map(day => (
                    <th key={day} style={{ minWidth: '200px', textAlign: 'center', background: 'var(--surface-strong)', color: 'var(--ink)' }}>{dayIndoToEng[day] || day}</th>
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
                                      <span className="matrix-card-class">Class {j.kelas || '-'}</span>
                                    </div>
                                    <div className="matrix-card-title">{j.mataKuliah?.nama}</div>
                                    <div className="matrix-card-details">
                                      <div className="matrix-detail-item">Lab: {j.ruangan?.nama || 'Lab TBD'}</div>
                                      <div className="matrix-detail-item">Lec: {j.dosen?.user?.nama || 'No Lecturer'}</div>
                                      <div className="matrix-detail-item">Asst: {j.asisten?.user?.nama || 'No Assistant'}</div>
                                      <div className="matrix-detail-item">Cap: {j.ruangan?.kapasitas || '-'} Students</div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="matrix-empty-slot">Empty</div>
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
              <div className="empty-state-icon"></div>
              <p>No schedules found</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Course / Practicum</th>
                    <th>Lecturer</th>
                    <th>Assigned Assistant</th>
                    <th>Day & Time</th>
                    <th>Class</th>
                    <th>Room</th>
                    <th>Capacity</th>
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
                      <td>{j.dosen?.user?.nama || '-'}</td>
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
                          <span className="text-muted">No assistant assigned</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-hadir" style={{ marginRight: '8px' }}>
                          {dayIndoToEng[j.hari] || j.hari}
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
                      <td>{j.ruangan?.kapasitas ? `${j.ruangan.kapasitas} students` : '-'}</td>
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
              <h3 className="modal-title">Create New Schedule</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label">Course / Practicum</label>
                <select 
                  name="mataKuliahId" 
                  className="form-select" 
                  required
                  value={formData.mataKuliahId} 
                  onChange={handleFormChange}
                >
                  <option value="" disabled>-- Select Course --</option>
                  {matkul.map(m => (
                    <option key={m.id} value={m.id}>{m.kode} - {m.nama}</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Assigned Assistant (Optional)</label>
                  <select 
                    name="asisenId" 
                    className="form-select" 
                    value={formData.asisenId} 
                    onChange={handleFormChange}
                  >
                    <option value="">-- Select Assistant --</option>
                    {asisten.map(a => (
                      <option key={a.id} value={a.id}>{a.user?.nama} ({a.stambuk})</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Lecturer (Dosen) (Optional)</label>
                  <select 
                    name="dosenId" 
                    className="form-select" 
                    value={formData.dosenId} 
                    onChange={handleFormChange}
                  >
                    <option value="">-- Select Lecturer --</option>
                    {dosen.map(d => (
                      <option key={d.id} value={d.id}>{d.nid} - {d.user?.nama}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Lab Room (Optional)</label>
                  <select 
                    name="ruanganId" 
                    className="form-select" 
                    value={formData.ruanganId} 
                    onChange={handleFormChange}
                  >
                    <option value="">-- Select Room --</option>
                    {ruangan.map(r => (
                      <option key={r.id} value={r.id}>{r.nama} (Kap: {r.kapasitas})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Day</label>
                  <select 
                    name="hari" 
                    className="form-select" 
                    required
                    value={formData.hari} 
                    onChange={handleFormChange}
                  >
                    <option value="Senin">Monday</option>
                    <option value="Selasa">Tuesday</option>
                    <option value="Rabu">Wednesday</option>
                    <option value="Kamis">Thursday</option>
                    <option value="Jumat">Friday</option>
                    <option value="Sabtu">Saturday</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Select Practicum Session</label>
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

                <div className="form-group">
                  <label className="form-label">Class</label>
                  <select
                    name="kelasId"
                    className="form-select"
                    required
                    value={formData.kelasId}
                    onChange={handleFormChange}
                    disabled={!formData.mataKuliahId}
                  >
                    <option value="" disabled>
                      {!formData.mataKuliahId ? '-- Select Course First --' : '-- Select Class --'}
                    </option>
                    {kelasDataList
                      .filter(c => String(c.mataKuliahId) === String(formData.mataKuliahId))
                      .map(cls => (
                        <option key={cls.id} value={cls.id}>
                          {cls.namaKelas}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
