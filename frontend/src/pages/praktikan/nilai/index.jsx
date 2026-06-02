import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './nilai.css';

export default function PraktikanNilai() {
  const [dataNilai, setDataNilai] = useState({ nilaiDetail: [], rekapAkhir: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNilai = async () => {
      try {
        setLoading(true);
        const data = await api.get('/praktikan/nilai');
        setDataNilai(data);
      } catch (err) {
        setError('Failed to load your gradebook recap');
      } finally {
        setLoading(false);
      }
    };
    fetchNilai();
  }, []);

  return (
    <DashboardLayout title="My Gradebook">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Gradebook</h1>
          <p className="page-subtitle">Monitor all achievements in tasks, exams, lab assistance, and final grades</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      {loading ? (
        <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
      ) : (
        <div>
          {/* Nilai Akhir Summary */}
          <div className="card mb-8">
            <div className="card-header">
              <h3 className="card-title">Final Course Grade Summary</h3>
            </div>
            {dataNilai.rekapAkhir.length === 0 ? (
              <div className="empty-state">
                <p>No final grades published for this semester yet</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Course / Practicum</th>
                      <th>Practicum</th>
                      <th>Assistance</th>
                      <th>Midterm</th>
                      <th>Final Exam</th>
                      <th>Final Grade</th>
                      <th>Letter Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataNilai.rekapAkhir.map(r => (
                      <tr key={r.id}>
                        <td className="text-mono">{r.mataKuliah?.kode}</td>
                        <td><strong>{r.mataKuliah?.nama}</strong><br /><span className="text-muted text-mono" style={{ fontSize: '11px' }}>Semester: {r.semester}</span></td>
                        <td className="text-mono">{r.nilaiPraktikum !== null ? Number(r.nilaiPraktikum).toFixed(1) : '-'}</td>
                        <td className="text-mono">{r.nilaiAsistensi !== null ? Number(r.nilaiAsistensi).toFixed(1) : '-'}</td>
                        <td className="text-mono">{r.nilaiUts !== null ? Number(r.nilaiUts).toFixed(1) : '-'}</td>
                        <td className="text-mono">{r.nilaiUas !== null ? Number(r.nilaiUas).toFixed(1) : '-'}</td>
                        <td>
                          <strong className="text-mono" style={{ color: 'var(--pacific-blue-dark)', fontSize: '15px' }}>
                            {r.nilaiAkhir !== null ? Number(r.nilaiAkhir).toFixed(2) : '-'}
                          </strong>
                        </td>
                        <td>
                          <span className={`badge ${['A', 'A-', 'B+', 'B'].includes(r.grade) ? 'badge-status-active' : 'badge-status-inactive'}`} style={{ fontWeight: '600', padding: '4px 10px' }}>
                            {r.grade || 'E'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rincian Komponen Nilai */}
          <div className="nilai-section-title">Detailed Grade Log</div>
          
          <div className="card">
            {dataNilai.nilaiDetail.length === 0 ? (
              <div className="empty-state">
                <p>No detailed task or exam grades entered by assistants/lecturers yet</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Grading Component</th>
                      <th>Weight</th>
                      <th>Grade Obtained</th>
                      <th>Instructor Notes</th>
                      <th>Input Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataNilai.nilaiDetail.map(n => {
                      const tgl = new Date(n.diinputPada).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                      return (
                        <tr key={n.id}>
                          <td>
                            <strong>{n.komponen?.mataKuliah?.nama}</strong>
                            <br />
                            <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {n.komponen?.mataKuliah?.kode}
                            </span>
                          </td>
                          <td>
                            <strong>{n.komponen?.nama}</strong>
                            <br />
                            <span className="badge badge-status-active" style={{ fontSize: '10px', textTransform: 'capitalize', marginTop: '4px' }}>
                              {n.komponen?.kategori}
                            </span>
                          </td>
                          <td className="text-mono">{n.komponen?.bobot}%</td>
                          <td>
                            <strong className="text-mono" style={{ fontSize: '15px' }}>
                              {Number(n.nilai).toFixed(1)}
                            </strong>
                          </td>
                          <td>
                            <span style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--body)' }}>
                              {n.catatan ? `"${n.catatan}"` : '-'}
                            </span>
                          </td>
                          <td className="text-mono" style={{ fontSize: '12px' }}>{tgl}</td>
                        </tr>
                      );
                    })}
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
