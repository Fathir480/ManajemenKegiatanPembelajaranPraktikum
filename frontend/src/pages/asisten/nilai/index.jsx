import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './nilai.css';

const dayMap = {
  'Senin': 'Monday',
  'Selasa': 'Tuesday',
  'Rabu': 'Wednesday',
  'Kamis': 'Thursday',
  'Jumat': 'Friday',
  'Sabtu': 'Saturday',
  'Minggu': 'Sunday'
};

export default function AsistenNilai() {
  const [jadwal, setJadwal] = useState([]);
  const [komponen, setKomponen] = useState([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState('');
  const [selectedKomponenId, setSelectedKomponenId] = useState('');
  
  const [peserta, setPeserta] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Local state for editing grades
  const [grades, setGrades] = useState({}); // { [mahasiswaId]: { nilai, catatan } }

  const fetchJadwal = async () => {
    try {
      const data = await api.get('/asisten/jadwal');
      setJadwal(data);
      if (data.length > 0) setSelectedJadwalId(data[0].id);
    } catch (err) {
      setError('Failed to fetch assigned classes list');
    }
  };

  useEffect(() => {
    fetchJadwal();
  }, []);

  // Fetch KomponenNilai when Jadwal changes
  useEffect(() => {
    if (!selectedJadwalId) {
      setKomponen([]);
      setSelectedKomponenId('');
      return;
    }
    const currentJadwal = jadwal.find(j => j.id === parseInt(selectedJadwalId));
    if (currentJadwal?.mataKuliahId) {
      api.get(`/asisten/komponen/${currentJadwal.mataKuliahId}`)
        .then(data => {
          // Filter only components input by assistant
          const asistenComp = data.filter(c => c.diinputOleh === 'asisten');
          setKomponen(asistenComp);
          if (asistenComp.length > 0) setSelectedKomponenId(asistenComp[0].id);
          else setSelectedKomponenId('');
        })
        .catch(() => setError('Failed to load grading components'));
    }
  }, [selectedJadwalId, jadwal]);

  // Fetch Peserta & existing grades when Jadwal and Komponen change
  const fetchPesertaNilai = async () => {
    if (!selectedJadwalId || !selectedKomponenId) {
      setPeserta([]);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/asisten/jadwal/${selectedJadwalId}/nilai/${selectedKomponenId}`);
      setPeserta(data);
      
      // Initialize grades state
      const initialGrades = {};
      data.forEach(p => {
        initialGrades[p.mahasiswaId] = {
          nilai: p.nilai !== null ? p.nilai : 0,
          catatan: p.catatan || ''
        };
      });
      setGrades(initialGrades);
    } catch (err) {
      setError('Failed to load participant grade data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPesertaNilai();
  }, [selectedJadwalId, selectedKomponenId]);

  const handleGradeChange = (mahasiswaId, field, value) => {
    setGrades(prev => ({
      ...prev,
      [mahasiswaId]: {
        ...prev[mahasiswaId],
        [field]: value
      }
    }));
  };

  const handleSaveGrade = async (mahasiswaId) => {
    setError('');
    setSuccess('');
    const mGrade = grades[mahasiswaId];
    
    if (mGrade.nilai < 0 || mGrade.nilai > 100) {
      setError('Grade must be in the range of 0 to 100');
      return;
    }

    try {
      await api.post('/asisten/nilai', {
        mahasiswaId,
        komponenId: selectedKomponenId,
        nilai: mGrade.nilai,
        catatan: mGrade.catatan,
        sesiId: null // default null for component-level grades
      });
      setSuccess('Student grade saved successfully!');
      fetchPesertaNilai();
    } catch (err) {
      setError(err.message || 'Failed to save grade');
    }
  };

  return (
    <DashboardLayout title="Grade Input">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Practicum Grade Input</h1>
          <p className="page-subtitle">Manage task, assistance, and active participation grades for students under your guidance</p>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="nilai-grid-header">
          <div className="flex gap-4 flex-wrap" style={{ flex: 1 }}>
            <div className="form-group" style={{ minWidth: '220px' }}>
              <label className="form-label">Select Class</label>
              <select
                className="form-select"
                value={selectedJadwalId}
                onChange={(e) => setSelectedJadwalId(e.target.value)}
              >
                <option value="">-- Select Class --</option>
                {jadwal.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.mataKuliah?.nama} ({dayMap[j.hari] || j.hari}, {j.jamMulai}-{j.jamSelesai})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ minWidth: '220px' }}>
              <label className="form-label">Select Component</label>
              <select
                className="form-select"
                value={selectedKomponenId}
                onChange={(e) => setSelectedKomponenId(e.target.value)}
                disabled={komponen.length === 0}
              >
                {komponen.length === 0 ? (
                  <option value="">No assistant components</option>
                ) : (
                  komponen.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nama} (Weight: {c.bobot}%)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {!selectedJadwalId || !selectedKomponenId ? (
          <div className="empty-state">
            <p>Please select a class and grade component to begin</p>
          </div>
        ) : loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : peserta.length === 0 ? (
          <div className="empty-state">
            <p>No students registered in this class</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th style={{ width: '120px' }}>Grade (0 - 100)</th>
                  <th>Notes / Description</th>
                  <th style={{ width: '100px' }}>Action</th>
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
                      <input 
                        type="number" 
                        className="form-input input-nilai-field" 
                        min="0"
                        max="100"
                        value={grades[p.mahasiswaId]?.nilai ?? ''}
                        onChange={(e) => handleGradeChange(p.mahasiswaId, 'nilai', e.target.value)}
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Example: Excellent report, active in class..."
                        value={grades[p.mahasiswaId]?.catatan ?? ''}
                        onChange={(e) => handleGradeChange(p.mahasiswaId, 'catatan', e.target.value)}
                      />
                    </td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleSaveGrade(p.mahasiswaId)}
                      >
                        Save
                      </button>
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
