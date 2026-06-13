import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import '../absensi/absensi.css';

export default function AdminNilai() {
  const [classes, setClasses] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [students, setStudents] = useState([]);
  const [komponen, setKomponen] = useState([]);
  const [kelasDetails, setKelasDetails] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState('');

  // Kolom tetap yang diminta: 6 praktikum, 3 asistensi, uts, uas
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
      const data = await api.get('/admin/kelas');
      setClasses(data);
      if (data.length > 0) {
        setSelectedKelasId(String(data[0].id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load classes.');
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchNilaiData = async (kelasId) => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/admin/nilai/kelas/${kelasId}`);
      setStudents(data.students || []);
      setKomponen(data.komponen || []);
      setKelasDetails(data.kelas || null);
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
      setKelasDetails(null);
    }
  }, [selectedKelasId]);

  const handleKelasChange = (e) => {
    setSelectedKelasId(e.target.value);
  };

  const getNilaiForColumn = (student, col) => {
    if (col.type === 'final') {
      return calculateFinalGrade(student.nilai);
    }

    // Filter komponen by category
    const kompTerkait = komponen.filter(k => k.kategori === col.type);
    
    // Sort to match index (e.g. Praktikum 1 is the first praktikum component)
    kompTerkait.sort((a, b) => a.id - b.id);

    // If the component index doesn't exist (e.g. only 4 praktikum exist but this is P5)
    if (col.index && col.index > kompTerkait.length) {
      return null;
    }

    let targetKomponen;
    if (col.index) {
      targetKomponen = kompTerkait[col.index - 1];
    } else {
      targetKomponen = kompTerkait[0]; // for UTS/UAS where index is not used
    }

    if (!targetKomponen) return null;

    const nilaiRecord = student.nilai.find(n => n.komponenId === targetKomponen.id);
    return nilaiRecord ? nilaiRecord.nilai : 0;
  };

  const calculateFinalGrade = (nilaiList) => {
    if (komponen.length === 0) return 0;
    
    const categoryStats = {};
    komponen.forEach(k => {
      if (!categoryStats[k.kategori]) categoryStats[k.kategori] = { totalBobot: 0, filledScores: [] };
      categoryStats[k.kategori].totalBobot += parseFloat(k.bobot);

      const n = nilaiList.find(nl => nl.komponenId === k.id);
      if (n && n.nilai !== null && n.nilai !== undefined && n.nilai !== '') {
        categoryStats[k.kategori].filledScores.push(parseFloat(n.nilai));
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

  const handleExportExcel = () => {
    const headers = ['Student Name', 'NIM / Stambuk', ...fixedColumns.map(c => c.label)];
    
    const dataRows = students.map(std => {
      const row = [std.nama, std.stambuk];
      fixedColumns.forEach(col => {
        const val = getNilaiForColumn(std, col);
        row.push(val !== null ? val : '-');
      });
      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Grade Matrix');
    
    const classNameStr = kelasDetails ? `${kelasDetails.namaKelas}_${kelasDetails.mataKuliah}`.replace(/[^a-zA-Z0-9_]/g, '_') : 'Class';
    
    XLSX.writeFile(workbook, `Grades_Matrix_${classNameStr}.xlsx`);
  };

  return (
    <DashboardLayout title="Student Grades">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Course Grades</h1>
          <p className="page-subtitle">View and export student grades mapped to 6 Praktikum, 3 Asistensi, UTS, and UAS</p>
        </div>
        <div className="flex gap-3">
          {selectedKelasId && students.length > 0 && (
            <button className="btn btn-ghost" onClick={handleExportExcel}>
              Export to Excel
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

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

        {loading ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Compiling grade matrix...</span>
          </div>
        ) : !selectedKelasId ? (
          <div className="empty-state" style={{ padding: '80px 0' }}>
            <p>Please select a class group from the dropdown list above.</p>
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0' }}>
            <p>No students enrolled in this class group yet.</p>
          </div>
        ) : komponen.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0', border: '2px dashed var(--hairline-strong)' }}>
            <p className="mb-4">No grade components found for this course.</p>
            <div className="alert alert-info text-center" style={{ maxWidth: '480px', margin: '0 auto', fontSize: '13px' }}>
              <strong>Notice:</strong> Komponen nilai biasanya diatur oleh dosen pengampu atau ter-generate otomatis saat verify jadwal.
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
                      const val = getNilaiForColumn(std, col);
                      const isNull = val === null;
                      return (
                        <td 
                          key={col.key} 
                          style={{ 
                            textAlign: 'center', 
                            verticalAlign: 'middle', 
                            padding: '10px 4px',
                            color: isNull ? 'var(--muted)' : (col.type === 'final' ? 'var(--pacific-blue)' : 'var(--ink)'),
                            fontWeight: col.type === 'final' ? 'bold' : 'normal',
                            backgroundColor: isNull ? 'var(--surface-soft)' : 'transparent'
                          }}
                        >
                          <span className="text-mono" style={{ fontSize: '12px' }}>
                            {isNull ? '-' : val}
                          </span>
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
