import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import * as XLSX from 'xlsx';
import './rekap.css';

export default function DosenRekap() {
  const [matkul, setMatkul] = useState([]);
  const [selectedMatkulId, setSelectedMatkulId] = useState('');
  const [rekap, setRekap] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMatkul = async () => {
    try {
      const data = await api.get('/dosen/matkul');
      setMatkul(data);
      if (data.length > 0) setSelectedMatkulId(data[0].id);
    } catch (err) {
      setError('Gagal mengambil daftar mata kuliah');
    }
  };

  useEffect(() => {
    fetchMatkul();
  }, []);

  const fetchRekap = async () => {
    if (!selectedMatkulId) {
      setRekap([]);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await api.get(`/dosen/rekap/${selectedMatkulId}`);
      setRekap(data);
    } catch (err) {
      setError('Gagal memuat rekapitulasi nilai akhir');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRekap();
  }, [selectedMatkulId]);

  const handleExportExcel = () => {
    if (rekap.length === 0) return;
    
    const activeMatkul = matkul.find(m => m.id === parseInt(selectedMatkulId));
    
    // Format data for sheet
    const formattedData = rekap.map((r, idx) => ({
      'No': idx + 1,
      'Nama': r.mahasiswa?.user?.nama || '-',
      'Stambuk': r.mahasiswa?.stambuk || '-',
      'Nilai Praktikum': r.nilaiPraktikum !== null ? Number(r.nilaiPraktikum) : '-',
      'Nilai Asistensi': r.nilaiAsistensi !== null ? Number(r.nilaiAsistensi) : '-',
      'Nilai UTS': r.nilaiUts !== null ? Number(r.nilaiUts) : '-',
      'Nilai UAS': r.nilaiUas !== null ? Number(r.nilaiUas) : '-',
      'Nilai Akhir': r.nilaiAkhir !== null ? Number(r.nilaiAkhir) : '-',
      'Grade': r.grade || '-',
      'Semester': r.semester || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');

    // Generate buffer & trigger download
    XLSX.writeFile(workbook, `Rekap_Nilai_${activeMatkul?.nama.replace(/\s+/g, '_')}_${new Date().getFullYear()}.xlsx`);
  };

  const filteredRekap = rekap.filter(r => 
    r.mahasiswa?.user?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.mahasiswa?.stambuk?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Rekap Nilai">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Rekapitulasi Nilai Akhir</h1>
          <p className="page-subtitle">Lihat, pantau, dan ekspor laporan nilai akhir serta grade kelulusan praktikan</p>
        </div>
        {rekap.length > 0 && (
          <button className="btn btn-primary" onClick={handleExportExcel}>
            📥 Ekspor Ke Excel (.xlsx)
          </button>
        )}
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="rekap-controls">
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
            
            {rekap.length > 0 && (
              <div className="form-group" style={{ minWidth: '220px' }}>
                <label className="form-label">Pencarian Mahasiswa</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Cari nama atau stambuk..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}
          </div>
          
          {rekap.length > 0 && (
            <div className="text-muted text-mono" style={{ fontSize: '12px', marginTop: '16px' }}>
              Menampilkan {filteredRekap.length} data rekap
            </div>
          )}
        </div>

        {!selectedMatkulId ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>Silakan pilih mata kuliah terlebih dahulu</p>
          </div>
        ) : loading ? (
          <div className="flex-center" style={{ minHeight: '200px' }}><div className="spinner" /></div>
        ) : rekap.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤷‍♂️</div>
            <p>Belum ada data rekapitulasi untuk mata kuliah ini</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Mahasiswa</th>
                  <th>Stambuk</th>
                  <th>Praktikum</th>
                  <th>Asistensi</th>
                  <th>UTS</th>
                  <th>UAS</th>
                  <th>Nilai Akhir</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {filteredRekap.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="text-mono">{idx + 1}</td>
                    <td><strong>{r.mahasiswa?.user?.nama}</strong></td>
                    <td className="text-mono">{r.mahasiswa?.stambuk}</td>
                    <td className="text-mono">{r.nilaiPraktikum !== null ? Number(r.nilaiPraktikum).toFixed(1) : '-'}</td>
                    <td className="text-mono">{r.nilaiAsistensi !== null ? Number(r.nilaiAsistensi).toFixed(1) : '-'}</td>
                    <td className="text-mono">{r.nilaiUts !== null ? Number(r.nilaiUts).toFixed(1) : '-'}</td>
                    <td className="text-mono">{r.nilaiUas !== null ? Number(r.nilaiUas).toFixed(1) : '-'}</td>
                    <td>
                      <strong className="text-mono" style={{ color: 'var(--pacific-blue-dark)' }}>
                        {r.nilaiAkhir !== null ? Number(r.nilaiAkhir).toFixed(2) : '-'}
                      </strong>
                    </td>
                    <td>
                      <span className={`badge ${['A', 'A-', 'B+', 'B'].includes(r.grade) ? 'badge-hadir' : 'badge-alpa'}`} style={{ fontWeight: '600' }}>
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
    </DashboardLayout>
  );
}
