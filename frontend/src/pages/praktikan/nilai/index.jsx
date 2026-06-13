import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './nilai.css';

export default function PraktikanNilai() {
  const [classes, setClasses] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [students, setStudents] = useState([]);
  const [komponen, setKomponen] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState('');

  // Fixed layout columns
  const fixedColumns = [
    { key: 'p1', label: 'P 1', type: 'praktikum', index: 1 },
    { key: 'p2', label: 'P 2', type: 'praktikum', index: 2 },
    { key: 'p3', label: 'P 3', type: 'praktikum', index: 3 },
    { key: 'p4', label: 'P 4', type: 'praktikum', index: 4 },
    { key: 'p5', label: 'P 5', type: 'praktikum', index: 5 },
    { key: 'p6', label: 'P 6', type: 'praktikum', index: 6 },
    { key: 'a1', label: 'A 1', type: 'asistensi', index: 1 },
    { key: 'a2', label: 'A 2', type: 'asistensi', index: 2 },
    { key: 'a3', label: 'A 3', type: 'asistensi', index: 3 },
    { key: 'uts', label: 'UTS', type: 'uts' },
    { key: 'uas', label: 'UAS', type: 'uas' },
    { key: 'final', label: 'N. Akhir', type: 'final' }
  ];

  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const data = await api.get('/praktikan/enrolled-classes');
      setClasses(data);
      if (data.length > 0) {
        setSelectedKelasId(String(data[0].id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load your enrolled classes.');
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchNilaiData = async (kelasId) => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/praktikan/nilai/kelas/${kelasId}`);
      setStudents(data.students || []);
      setKomponen(data.komponen || []);
    } catch (err) {
      setError(err.message || 'Failed to load class grades data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedKelasId) {
      fetchNilaiData(selectedKelasId);
    } else {
      setStudents([]);
      setKomponen([]);
    }
  }, [selectedKelasId]);

  const handleKelasChange = (e) => {
    setSelectedKelasId(e.target.value);
  };

  const getTargetKomponen = (col) => {
    const kompTerkait = komponen.filter(k => k.kategori === col.type);
    kompTerkait.sort((a, b) => a.id - b.id);
    if (col.index && col.index > kompTerkait.length) return null;
    return col.index ? kompTerkait[col.index - 1] : kompTerkait[0];
  };

  const getNilaiForColumn = (student, col) => {
    if (col.type === 'final') return calculateFinalGrade(student);
    
    const targetKomponen = getTargetKomponen(col);
    if (!targetKomponen) return null;

    const nilaiRecord = student.nilai.find(n => n.komponenId === targetKomponen.id);
    return nilaiRecord && nilaiRecord.nilai !== null ? Number(nilaiRecord.nilai) : '';
  };

  const calculateFinalGrade = (student) => {
    if (komponen.length === 0) return 0;
    
    // Attempt to use rekapAkhir from backend if already available and accurate
    // but calculating dynamically is safer for display just like DosenNilai does
    
    const categoryStats = {};
    komponen.forEach(k => {
      if (!categoryStats[k.kategori]) categoryStats[k.kategori] = { totalBobot: 0, filledScores: [] };
      categoryStats[k.kategori].totalBobot += parseFloat(k.bobot);

      const n = student.nilai.find(nl => nl.komponenId === k.id);
      let scoreVal = (n && n.nilai !== null && n.nilai !== undefined) ? n.nilai : '';

      if (scoreVal !== '' && scoreVal !== null) {
        categoryStats[k.kategori].filledScores.push(parseFloat(scoreVal));
      }
    });

    let totalNilai = 0;
    let totalBobotAktif = 0;

    Object.values(categoryStats).forEach(stat => {
      let averageScore = 0;
      if (stat.filledScores.length > 0) {
        const sum = stat.filledScores.reduce((a, b) => a + b, 0);
        averageScore = sum / stat.filledScores.length;
      }
      totalNilai += (averageScore * (stat.totalBobot / 100));
      totalBobotAktif += stat.totalBobot;
    });

    if (totalBobotAktif === 0) return 0;
    const finalScore = (totalNilai / (totalBobotAktif / 100));
    return finalScore.toFixed(2);
  };

  return (
    <DashboardLayout title="Grade Recap">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Gradebook Matrix</h1>
          <p className="page-subtitle">View your detailed grades for each enrolled class</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="absensi-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div className="form-group mb-0" style={{ minWidth: '320px', flexGrow: 0 }}>
            <label className="form-label text-mono" style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>Select Practicum Class</label>
            {loadingClasses ? (
              <div className="text-muted text-mono" style={{ fontSize: '12px' }}>Loading your classes...</div>
            ) : classes.length === 0 ? (
              <div className="text-muted text-mono" style={{ fontSize: '12px', color: 'var(--error)' }}>You are not enrolled in any classes.</div>
            ) : (
              <select 
                className="form-select text-mono" 
                value={selectedKelasId} 
                onChange={handleKelasChange}
                style={{ width: '100%', fontSize: '13px', textTransform: 'uppercase' }}
              >
                <option value="" disabled style={{ background: 'var(--surface)', color: 'var(--muted)' }}>-- Select Class --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
                    {c.namaKelas} - {c.mataKuliah?.nama}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Compiling grade matrix...</span>
          </div>
        ) : !selectedKelasId ? (
          <div className="empty-state" style={{ padding: '80px 0' }}>
            <p>Please select a class from the dropdown list above.</p>
          </div>
        ) : komponen.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0', border: '2px dashed var(--hairline-strong)' }}>
            <p className="mb-4">No grade components defined for this course.</p>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0' }}>
            <p>Your grade data was not found for this class.</p>
          </div>
        ) : (
          <div className="table-wrapper absensi-matrix-wrapper" style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table className="absensi-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: '260px', minWidth: '260px', textAlign: 'left', background: 'var(--surface-strong)', color: 'var(--ink)', position: 'sticky', left: 0, zIndex: 11 }}>
                    Student Name / NIM
                  </th>
                  {fixedColumns.map(col => (
                    <th key={col.key} style={{ minWidth: '60px', textAlign: 'center', background: 'var(--surface-soft)', color: 'var(--ink)' }}>
                      <span className="text-mono" style={{ fontSize: '11px', fontWeight: 600 }}>
                        {col.label}
                      </span>
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
                    {fixedColumns.map(col => {
                      const isNull = getTargetKomponen(col) === null && col.type !== 'final';
                      if (isNull) {
                        return (
                          <td key={col.key} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 4px', color: 'var(--muted)', backgroundColor: 'var(--surface-soft)' }}>
                            <span className="text-mono" style={{ fontSize: '12px' }}>-</span>
                          </td>
                        );
                      }

                      const val = getNilaiForColumn(std, col);

                      if (col.type === 'final') {
                        return (
                          <td key={col.key} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 4px', color: 'var(--pacific-blue)', fontWeight: 'bold' }}>
                            <span className="text-mono" style={{ fontSize: '12px' }}>{val}</span>
                          </td>
                        );
                      }

                      // All other columns are read-only for Praktikan
                      return (
                        <td key={col.key} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 4px', color: 'var(--ink)' }}>
                          <span className="text-mono" style={{ fontSize: '13px' }}>{val !== '' ? val : '0'}</span>
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
    </DashboardLayout>
  );
}
