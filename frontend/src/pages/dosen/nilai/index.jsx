import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './nilai.css';

export default function DosenNilai() {
  const [matkul, setMatkul] = useState([]);
  const [komponen, setKomponen] = useState([]);
  const [selectedMatkulId, setSelectedMatkulId] = useState('');
  const [selectedKomponenId, setSelectedKomponenId] = useState('');
  
  const [peserta, setPeserta] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Local state for editing grades
  const [grades, setGrades] = useState({}); // { [mahasiswaId]: { nilai, catatan } }

  const fetchMatkul = async () => {
    try {
      const data = await api.get('/dosen/matkul');
      setMatkul(data);
      if (data.length > 0) setSelectedMatkulId(data[0].id);
    } catch (err) {
      setError('Gagal mengambil daftar mata kuliah diampu');
    }
  };

  useEffect(() => {
    fetchMatkul();
  }, []);

  // Fetch components when matkul changes
  useEffect(() => {
    if (!selectedMatkulId) {
      setKomponen([]);
      setSelectedKomponenId('');
      return;
    }
    api.get(`/dosen/komponen/${selectedMatkulId}`)
      .then(data => {
        // Filter components input by Dosen
        const dosenComp = data.filter(c => c.diinputOleh === 'dosen');
        setKomponen(dosenComp);
        if (dosenComp.length > 0) setSelectedKomponenId(dosenComp[0].id);
        else setSelectedKomponenId('');
      })
      .catch(() => setError('Gagal memuat komponen penilaian'));
  }, [selectedMatkulId]);

  // Fetch student participants and current grades
  const fetchPesertaNilai = async () => {
    if (!selectedMatkulId || !selectedKomponenId) {
      setPeserta([]);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/dosen/matkul/${selectedMatkulId}/nilai/${selectedKomponenId}`);
      setPeserta(data);
      
      const initialGrades = {};
      data.forEach(p => {
        initialGrades[p.mahasiswaId] = {
          nilai: p.nilai !== null ? p.nilai : 0,
          catatan: p.catatan || ''
        };
      });
      setGrades(initialGrades);
    } catch (err) {
      setError('Gagal memuat peserta kelas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPesertaNilai();
  }, [selectedMatkulId, selectedKomponenId]);

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
      setError('Nilai harus berada di rentang 0 s/d 100');
      return;
    }

    try {
      await api.post('/dosen/nilai', {
        mahasiswaId,
        komponenId: selectedKomponenId,
        nilai: mGrade.nilai,
        catatan: mGrade.catatan
      });
      setSuccess('Nilai mahasiswa berhasil disimpan!');
      fetchPesertaNilai();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan nilai');
    }
  };

  return (
    <DashboardLayout title="Input Nilai Dosen">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Input Nilai UTS / UAS</h1>
          <p className="page-subtitle">Kelola input nilai ujian resmi (UTS, UAS, Tugas Besar) mahasiswa</p>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="nilai-dosen-header">
          <div className="flex gap-4 flex-wrap" style={{ flex: 1 }}>
            <div className="form-group" style={{ minWidth: '220px' }}>
              <label className="form-label">Mata Kuliah</label>
              <select
                className="form-select"
                value={selectedMatkulId}
                onChange={(e) => setSelectedMatkulId(e.target.value)}
              >
                <option value="">-- Pilih Mata Kuliah --</option>
                {matkul.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.kode} - {m.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ minWidth: '220px' }}>
              <label className="form-label">Komponen Ujian</label>
              <select
                className="form-select"
                value={selectedKomponenId}
                onChange={(e) => setSelectedKomponenId(e.target.value)}
                disabled={komponen.length === 0}
              >
                {komponen.length === 0 ? (
                  <option value="">Tidak ada komponen dosen</option>
                ) : (
                  komponen.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nama} (Bobot: {c.bobot}%)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {!selectedMatkulId || !selectedKomponenId ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>Silakan pilih mata kuliah dan komponen penilaian untuk memulai</p>
          </div>
        ) : loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : peserta.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👨‍🎓</div>
            <p>Tidak ada mahasiswa terdaftar di kelas praktikum mata kuliah ini</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>Stambuk</th>
                  <th style={{ width: '120px' }}>Nilai Ujian</th>
                  <th>Catatan / Keterangan</th>
                  <th style={{ width: '100px' }}>Aksi</th>
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
                        className="form-input input-grade" 
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
                        placeholder="Keterangan tambahan..."
                        value={grades[p.mahasiswaId]?.catatan ?? ''}
                        onChange={(e) => handleGradeChange(p.mahasiswaId, 'catatan', e.target.value)}
                      />
                    </td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleSaveGrade(p.mahasiswaId)}
                      >
                        💾 Simpan
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
