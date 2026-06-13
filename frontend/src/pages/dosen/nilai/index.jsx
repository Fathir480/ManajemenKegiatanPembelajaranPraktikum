import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import '../../admin/absensi/absensi.css';

export default function DosenNilai() {
  const [classes, setClasses] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [students, setStudents] = useState([]);
  const [komponen, setKomponen] = useState([]);
  const [kelasDetails, setKelasDetails] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [unsavedChanges, setUnsavedChanges] = useState({}); // { [mahasiswaId_komponenId]: value }

  // Fixed layout columns
  const fixedColumns = [
    { key: 'p1', label: 'P 1', type: 'praktikum', index: 1, readOnly: true },
    { key: 'p2', label: 'P 2', type: 'praktikum', index: 2, readOnly: true },
    { key: 'p3', label: 'P 3', type: 'praktikum', index: 3, readOnly: true },
    { key: 'p4', label: 'P 4', type: 'praktikum', index: 4, readOnly: true },
    { key: 'p5', label: 'P 5', type: 'praktikum', index: 5, readOnly: true },
    { key: 'p6', label: 'P 6', type: 'praktikum', index: 6, readOnly: true },
    { key: 'a1', label: 'A 1', type: 'asistensi', index: 1, readOnly: true },
    { key: 'a2', label: 'A 2', type: 'asistensi', index: 2, readOnly: true },
    { key: 'a3', label: 'A 3', type: 'asistensi', index: 3, readOnly: true },
    { key: 'uts', label: 'UTS', type: 'uts', readOnly: false },
    { key: 'uas', label: 'UAS', type: 'uas', readOnly: false },
    { key: 'final', label: 'N. Akhir', type: 'final', readOnly: true }
  ];

  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const data = await api.get('/dosen/kelas');
      setClasses(data);
      if (data.length > 0) {
        setSelectedKelasId(String(data[0].id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load assigned classes.');
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchNilaiData = async (kelasId) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setUnsavedChanges({});
      const data = await api.get(`/dosen/nilai/kelas/${kelasId}`);
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

    // Check if there's an unsaved change
    const changeKey = `${student.id}_${targetKomponen.id}`;
    if (unsavedChanges[changeKey] !== undefined) {
      return unsavedChanges[changeKey];
    }

    const nilaiRecord = student.nilai.find(n => n.komponenId === targetKomponen.id);
    return nilaiRecord ? nilaiRecord.nilai : '';
  };

  const handleGradeInputChange = (studentId, col, value) => {
    const targetKomponen = getTargetKomponen(col);
    if (!targetKomponen) return;

    setUnsavedChanges(prev => ({
      ...prev,
      [`${studentId}_${targetKomponen.id}`]: value
    }));
    setSuccess('');
  };

  const saveChanges = async () => {
    const updates = Object.keys(unsavedChanges).map(key => {
      const [mhsIdStr, kompIdStr] = key.split('_');
      return {
        mahasiswaId: parseInt(mhsIdStr),
        komponenId: parseInt(kompIdStr),
        nilai: unsavedChanges[key]
      };
    });

    if (updates.length === 0) return;

    try {
      setSaving(true);
      setError('');
      await api.post('/dosen/nilai/bulk', { updates });
      setSuccess('All grade changes have been saved successfully.');
      setUnsavedChanges({});
      // Refresh to ensure final grade calcs are fully updated server-side if needed
      await fetchNilaiData(selectedKelasId);
    } catch (err) {
      setError(err.message || 'Failed to save grade changes.');
    } finally {
      setSaving(false);
    }
  };

  const calculateFinalGrade = (student) => {
    if (komponen.length === 0) return 0;
    
    const categoryStats = {};
    komponen.forEach(k => {
      if (!categoryStats[k.kategori]) categoryStats[k.kategori] = { totalBobot: 0, filledScores: [] };
      categoryStats[k.kategori].totalBobot += parseFloat(k.bobot);

      const changeKey = `${student.id}_${k.id}`;
      let scoreVal = '';
      if (unsavedChanges[changeKey] !== undefined) {
        scoreVal = unsavedChanges[changeKey];
      } else {
        const n = student.nilai.find(nl => nl.komponenId === k.id);
        if (n && n.nilai !== null && n.nilai !== undefined) {
          scoreVal = n.nilai;
        }
      }

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

  const handleExportExcel = () => {
    const headers = ['Student Name', 'NIM / Stambuk', ...fixedColumns.map(c => c.label)];
    
    const dataRows = students.map(std => {
      const row = [std.nama, std.stambuk];
      fixedColumns.forEach(col => {
        const val = getNilaiForColumn(std, col);
        row.push(val !== null && val !== '' ? val : '-');
      });
      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Grade Matrix');
    
    const classNameStr = kelasDetails ? `${kelasDetails.namaKelas}_${kelasDetails.mataKuliah}`.replace(/[^a-zA-Z0-9_]/g, '_') : 'Class';
    XLSX.writeFile(workbook, `Grades_Matrix_${classNameStr}.xlsx`);
  };

  const hasUnsaved = Object.keys(unsavedChanges).length > 0;

  return (
    <DashboardLayout title="Student Grades">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Manage Grades</h1>
          <p className="page-subtitle">View class grade recap and input UTS/UAS scores directly</p>
        </div>
        <div className="flex gap-3">
          {hasUnsaved && (
            <button 
              className={`btn ${saving ? 'btn-ghost' : 'btn-primary'}`} 
              onClick={saveChanges}
              disabled={saving}
              style={{ fontWeight: 600 }}
            >
              {saving ? 'Saving...' : `Save Changes (${Object.keys(unsavedChanges).length})`}
            </button>
          )}
          {selectedKelasId && students.length > 0 && (
            <button className="btn btn-ghost" onClick={handleExportExcel}>
              Export to Excel
            </button>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="absensi-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div className="form-group mb-0" style={{ minWidth: '320px', flexGrow: 0 }}>
            <label className="form-label text-mono" style={{ fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>Select Taught Class</label>
            {loadingClasses ? (
              <div className="text-muted text-mono" style={{ fontSize: '12px' }}>Loading your classes...</div>
            ) : classes.length === 0 ? (
              <div className="text-muted text-mono" style={{ fontSize: '12px', color: 'var(--error)' }}>You are not assigned to any classes yet.</div>
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
        ) : students.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0' }}>
            <p>No students enrolled in this class group yet.</p>
          </div>
        ) : komponen.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 0', border: '2px dashed var(--hairline-strong)' }}>
            <p className="mb-4">No grade components defined for this course.</p>
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

                      if (col.readOnly) {
                        return (
                          <td key={col.key} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '10px 4px', color: 'var(--ink)' }}>
                            <span className="text-mono" style={{ fontSize: '12px' }}>{val !== '' ? val : '0'}</span>
                          </td>
                        );
                      }

                      // UTS / UAS input fields
                      const compId = getTargetKomponen(col).id;
                      const changeKey = `${std.id}_${compId}`;
                      const isEdited = unsavedChanges[changeKey] !== undefined;

                      return (
                        <td key={col.key} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '4px' }}>
                          <input 
                            type="number" 
                            min="0" max="100"
                            className="form-input text-mono text-center"
                            style={{ 
                              width: '60px', 
                              padding: '4px', 
                              fontSize: '12px',
                              borderColor: isEdited ? 'var(--pacific-blue)' : 'var(--hairline-strong)',
                              backgroundColor: isEdited ? 'var(--pacific-blue-soft)' : 'transparent',
                              margin: '0 auto'
                            }}
                            value={val}
                            onChange={(e) => handleGradeInputChange(std.id, col, e.target.value)}
                          />
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
