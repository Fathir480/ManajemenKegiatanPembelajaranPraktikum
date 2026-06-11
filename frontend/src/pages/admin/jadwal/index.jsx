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
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyDates, setVerifyDates] = useState({ tanggalMulai: '', tanggalSelesai: '', semester: '2024/2025 Genap' });
  const [semesterConfig, setSemesterConfig] = useState(null);
  const [selectedDayTab, setSelectedDayTab] = useState('Senin');
  const [editingId, setEditingId] = useState(null);

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

  const fetchSemesterConfig = async (semStr = '2024/2025 Genap') => {
    try {
      const res = await api.get(`/admin/jadwal/semester-config/${encodeURIComponent(semStr)}`);
      setSemesterConfig(res || null);
      if (res && res.tanggalMulai && res.tanggalSelesai) {
        setVerifyDates({
          tanggalMulai: res.tanggalMulai.split('T')[0],
          tanggalSelesai: res.tanggalSelesai.split('T')[0],
          semester: res.semester
        });
      }
    } catch (err) {
      console.error('Failed to fetch semester config:', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSemesterConfig('2024/2025 Genap');
  }, []);

  const handleOpenAddModal = (initialData = {}) => {
    setEditingId(null);
    setFormData({
      mataKuliahId: initialData.mataKuliahId || '',
      asisenId: initialData.asisenId || '',
      ruanganId: initialData.ruanganId || '',
      dosenId: initialData.dosenId || '',
      hari: initialData.hari || 'Senin',
      sesi: initialData.sesi || '1',
      jamMulai: initialData.jamMulai || '07:00',
      jamSelesai: initialData.jamSelesai || '09:30',
      kelasId: initialData.kelasId || ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (j) => {
    setEditingId(j.id);
    const selectedSesi = sessions.find(s => s.jamMulai === j.jamMulai) || sessions[0];
    setFormData({
      mataKuliahId: String(j.mataKuliahId || ''),
      asisenId: String(j.asisenId || ''),
      ruanganId: String(j.ruanganId || ''),
      dosenId: String(j.dosen?.id || j.dosenId || ''),
      hari: j.hari || 'Senin',
      sesi: String(selectedSesi.id),
      jamMulai: j.jamMulai || '07:00',
      jamSelesai: j.jamSelesai || '09:30',
      kelasId: String(j.kelasId || '')
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.delete(`/admin/jadwal/${id}`);
      setSuccess(res.message || 'Schedule successfully deleted');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete schedule');
    }
  };

  const handleOpenAddModalForSlot = (roomId, sesiId, jamMulai, jamSelesai) => {
    handleOpenAddModal({
      hari: selectedDayTab,
      ruanganId: String(roomId),
      sesi: String(sesiId),
      jamMulai,
      jamSelesai
    });
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
      if (editingId) {
        const res = await api.put(`/admin/jadwal/${editingId}`, formData);
        setSuccess(res.message || 'Practicum schedule successfully updated');
      } else {
        const res = await api.post('/admin/jadwal', formData);
        setSuccess(res.message || 'Practicum schedule successfully added');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to save schedule');
    }
  };

  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const dataRows = [];

    // Prepare room columns
    const roomHeaders = ruangan.map(room => `${room.nama} (${room.kode})`);
    const headers = ['Time / Room', ...roomHeaders];

    // For each day, append its matrix grid
    days.forEach((day, index) => {
      const dayName = (dayIndoToEng[day] || day).toUpperCase();
      
      // Add day header section
      dataRows.push([`DAY: ${dayName}`]);
      dataRows.push(headers);

      sessions.forEach(sesi => {
        const rowData = [sesi.time];
        
        ruangan.forEach(room => {
          const cellJadwal = jadwal.filter(j => 
            j.hari === day && 
            j.ruanganId === room.id &&
            ((j.jamMulai === sesi.jamMulai) || (j.jamMulai >= sesi.jamMulai && j.jamMulai < sesi.jamSelesai))
          );
          
          if (cellJadwal.length > 0) {
            const text = cellJadwal.map(j => 
              `[${j.mataKuliah?.kode || '-'}] ${j.mataKuliah?.nama || '-'}\nClass: ${j.kelas || '-'}\nLecturer: ${j.dosen?.user?.nama || '-'}\nAssistant: ${j.asisten?.user?.nama || '-'}`
            ).join('\n\n');
            rowData.push(text);
          } else {
            rowData.push('');
          }
        });
        
        dataRows.push(rowData);
      });

      // Add 2 empty rows for visual separation between day grids (except for the last day)
      if (index < days.length - 1) {
        dataRows.push([]);
        dataRows.push([]);
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(dataRows);
    
    // Set column widths and enable text wrap
    const wscols = [
      { wch: 18 }, // Time column
      ...ruangan.map(() => ({ wch: 35 })) // Room columns
    ];
    worksheet['!cols'] = wscols;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Weekly Schedule');
    XLSX.writeFile(workbook, 'Practicum_Schedule_Matrix.xlsx');
  };


  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setError('');
        setSuccess('');
        setLoading(true);

        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          setError('Excel file is empty or format is invalid');
          setLoading(false);
          return;
        }

        // Map keys
        const items = rawData.map(r => ({
          courseCode: String(r['Course Code'] || r['Kode Matakuliah'] || r['Kode Matkul'] || ''),
          assistantStambuk: r['Assistant Stambuk'] || r['Stambuk Asisten'] || '',
          roomCode: String(r['Room Code'] || r['Kode Ruangan'] || ''),
          lecturerNid: r['Lecturer NID'] || r['NID Dosen'] || '',
          day: String(r['Day'] || r['Hari'] || ''),
          jamMulai: String(r['Start Time'] || r['Jam Mulai'] || ''),
          jamSelesai: String(r['End Time'] || r['Jam Selesai'] || ''),
          className: String(r['Class'] || r['Kelas'] || ''),
          semester: r['Semester'] || ''
        }));

        const res = await api.post('/admin/jadwal/bulk', { items });
        setSuccess(res.message);
        setIsBulkModalOpen(false);
        fetchData();
      } catch (err) {
        setError(err.message || 'Failed to process Excel file');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleVerifyDatesChange = (e) => {
    const { name, value } = e.target;
    setVerifyDates(prev => ({ ...prev, [name]: value }));
  };

  const handleVerifySemesterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/admin/jadwal/verify-semester', verifyDates);
      setSuccess(res.message);
      setIsVerifyModalOpen(false);
      fetchSemesterConfig(verifyDates.semester);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to verify semester');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSemester = async () => {
    if (!window.confirm('Are you sure you want to cancel the verified semester schedule? This will delete all generated weekly sessions and any recorded student attendance.')) {
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.delete(`/admin/jadwal/semester-config/${encodeURIComponent(semesterConfig.semester)}`);
      setSuccess(res.message);
      setSemesterConfig(null);
      setVerifyDates({ tanggalMulai: '', tanggalSelesai: '', semester: '2024/2025 Genap' });
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to cancel semester');
    } finally {
      setLoading(false);
    }
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
          <button 
            className="btn btn-outline" 
            onClick={() => {
              if (semesterConfig) {
                setVerifyDates({
                  tanggalMulai: semesterConfig.tanggalMulai ? semesterConfig.tanggalMulai.split('T')[0] : '',
                  tanggalSelesai: semesterConfig.tanggalSelesai ? semesterConfig.tanggalSelesai.split('T')[0] : '',
                  semester: semesterConfig.semester
                });
              } else {
                setVerifyDates({ tanggalMulai: '', tanggalSelesai: '', semester: '2024/2025 Genap' });
              }
              setIsVerifyModalOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            title="Verify Semester"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Verify Semester</span>
          </button>
          <button className="btn btn-ghost" onClick={() => setIsBulkModalOpen(true)}>
            Bulk Import (Excel)
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            Create New Schedule
          </button>
        </div>
      </div>

      {semesterConfig && (
        <div className="alert alert-info mb-6" style={{ background: 'rgba(0, 150, 255, 0.08)', border: '1px solid rgba(0, 150, 255, 0.2)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ color: 'var(--ink)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              Semester is Active & Running
            </strong>
            <div className="text-muted text-mono" style={{ fontSize: '11px', marginTop: '4px' }}>
              Semester: {semesterConfig.semester} | Date Range: {new Date(semesterConfig.tanggalMulai).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} - {new Date(semesterConfig.tanggalSelesai).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-danger btn-sm" 
            onClick={handleCancelSemester}
            style={{ padding: '6px 12px', fontSize: '11px', letterSpacing: 0, textTransform: 'none', height: 'auto' }}
          >
            Cancel Semester
          </button>
        </div>
      )}

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
          <div className="matrix-grid-container">
            <div className="day-tabs-wrapper" style={{ marginBottom: '24px' }}>
              <div className="day-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--hairline)', paddingBottom: '12px', flexWrap: 'wrap' }}>
                {days.map(day => (
                  <button
                    key={day}
                    type="button"
                    className={`btn btn-sm ${selectedDayTab === day ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setSelectedDayTab(day)}
                    style={{ fontSize: '12px', fontWeight: 600 }}
                  >
                    {dayIndoToEng[day] || day}
                  </button>
                ))}
              </div>
            </div>

            {ruangan.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 0', border: '2px dashed var(--hairline-strong)' }}>
                <p>No lab rooms found. Please add a laboratory room in Lab Management first.</p>
              </div>
            ) : (
              <div className="table-wrapper matrix-wrapper" style={{ overflowX: 'auto' }}>
                <table className="matrix-table" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '130px', minWidth: '130px', background: 'var(--surface-strong)', color: 'var(--ink)' }}>Time / Room</th>
                      {ruangan.map(room => (
                        <th key={room.id} style={{ width: '280px', minWidth: '280px', textAlign: 'center', background: 'var(--surface-strong)', color: 'var(--ink)' }}>
                          {room.nama}
                          <br />
                          <span className="text-mono" style={{ fontSize: '10px', color: 'var(--body-muted)', textTransform: 'none', fontWeight: 400 }}>
                            {room.kode} • Cap: {room.kapasitas || '-'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(sesi => (
                      <tr key={sesi.id}>
                        <td className="matrix-sesi-cell">
                          <div className="matrix-sesi-time">{sesi.time}</div>
                        </td>
                        {ruangan.map(room => {
                          // Filter schedule matching day, room, and session time
                          const cellSchedule = filteredJadwal.find(j => 
                            j.hari === selectedDayTab &&
                            j.ruanganId === room.id &&
                            ((j.jamMulai === sesi.jamMulai) || (j.jamMulai >= sesi.jamMulai && j.jamMulai < sesi.jamSelesai))
                          );

                          const borderStyle = cellSchedule ? {
                            background: `rgba(255, 255, 255, 0.02)`,
                            textAlign: 'left'
                          } : null;

                          return (
                            <td key={room.id} className="matrix-slot-cell" style={{ verticalAlign: 'middle', padding: '8px' }}>
                              <div className="matrix-cards-container">
                                {cellSchedule ? (
                                  <div 
                                    className="matrix-card-compact" 
                                    style={borderStyle}
                                    title={`${cellSchedule.mataKuliah?.nama || ''} (Lec: ${cellSchedule.dosen?.user?.nama || '-'}, Asst: ${cellSchedule.asisten?.user?.nama || '-'})`}
                                  >
                                    <span className="compact-code">{cellSchedule.mataKuliah?.kode}</span>
                                    <span className="compact-nid">{cellSchedule.dosen?.nid || '-'}</span>
                                    <span className="compact-class">{cellSchedule.kelas || '-'}</span>
                                  </div>
                                ) : (
                                  <div 
                                    className="matrix-empty-slot"
                                    onClick={() => handleOpenAddModalForSlot(room.id, sesi.id, sesi.jamMulai, sesi.jamSelesai)}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      minHeight: '34px',
                                      padding: '6px 12px',
                                      border: '1px dashed var(--hairline-strong)',
                                      color: 'var(--muted)',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                      textTransform: 'uppercase',
                                      fontFamily: 'var(--font-mono)',
                                      letterSpacing: '0.5px'
                                    }}
                                  >
                                    + Add Schedule
                                  </div>
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
            )}
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
                    <th style={{ width: '80px' }}></th>
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
                      <td>
                        <div className="flex gap-3 justify-end" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button className="action-icon-btn action-edit" onClick={() => handleOpenEditModal(j)} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>
                          <button className="action-icon-btn action-delete" onClick={() => handleDelete(j.id)} title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </td>
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
              <h3 className="modal-title">{editingId ? 'Edit Schedule' : 'Create New Schedule'}</h3>
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
                  <option value="">-- Select Course --</option>
                  {matkul.map(m => (
                    <option key={m.id} value={m.id}>{m.kode} - {m.nama}</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Assigned Assistant</label>
                  <select 
                    name="asisenId" 
                    className="form-select" 
                    required
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
                  <label className="form-label">Lecturer (Dosen)</label>
                  <select 
                    name="dosenId" 
                    className="form-select" 
                    required
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
                  <label className="form-label">Lab Room</label>
                  <select 
                    name="ruanganId" 
                    className="form-select" 
                    required
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
                    <option value="">
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
                  {editingId ? 'Update Schedule' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* modal bulk upload */}
      {isBulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Schedule Operations</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Manage schedule data via Excel. You can export the current schedule matrix to use as a template or to save data, and upload a spreadsheet to register schedules in bulk.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <button type="button" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={handleExportExcel}>
                  Export Current Matrix (.xlsx)
                </button>
              </div>

              <div className="form-group" style={{ border: '2px dashed var(--hairline-strong)', padding: '24px', borderRadius: 'var(--radius-lg)', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>
                  Select Your Excel Import File
                </div>
                <div className="text-muted text-mono" style={{ fontSize: '11px', marginTop: '4px' }}>
                  Only supports .xlsx and .xls formats
                </div>
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleBulkUpload}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsBulkModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* modal verify semester */}
      {isVerifyModalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Verify Semester Schedule</h3>
              <button className="modal-close" onClick={() => setIsVerifyModalOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleVerifySemesterSubmit} className="login-form">
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '16px', lineHeight: 1.6 }}>
                Verify schedules for the entire semester. This action will distribute schedules to all lecturers, assistants, and students, and automatically generate weekly attendance session dates.
              </p>
              
              <div className="alert alert-warning mb-4" style={{ fontSize: '12px', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                <strong>Warning:</strong> Re-verifying will rebuild the practicum calendar. Existing attendance data for this semester's sessions will be lost if reset.
              </div>

              <div className="form-group">
                <label className="form-label">Semester</label>
                <input 
                  type="text"
                  name="semester"
                  className="form-input"
                  required
                  placeholder="e.g. 2024/2025 Genap"
                  value={verifyDates.semester}
                  onChange={handleVerifyDatesChange}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input 
                    type="date"
                    name="tanggalMulai"
                    className="form-input"
                    required
                    value={verifyDates.tanggalMulai}
                    onChange={handleVerifyDatesChange}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input 
                    type="date"
                    name="tanggalSelesai"
                    className="form-input"
                    required
                    value={verifyDates.tanggalSelesai}
                    onChange={handleVerifyDatesChange}
                  />
                </div>
              </div>

              <div className="flex-end gap-3" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setIsVerifyModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Verify Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
