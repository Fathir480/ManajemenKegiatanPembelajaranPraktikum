import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export default function AdminDashboard() {
  const user = getUser();
  const [stats, setStats] = useState({ mahasiswa: 0, dosen: 0, matkul: 0 });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [mhs, dsn, mk] = await Promise.all([
          api.get('/admin/mahasiswa'),
          api.get('/admin/dosen'),
          api.get('/admin/matkul'),
        ]);
        setStats({
          mahasiswa: mhs.length,
          dosen: dsn.length,
          matkul: mk.length,
        });
      } catch (e) { /* silent */ }
    };
    fetchStats();
  }, []);

  const handleExportAllData = async () => {
    try {
      setExporting(true);
      setError('');
      setSuccess('');

      // Fetch all admin data in parallel
      const [mhs, dsn, mk, kls, rng, jdw, ast] = await Promise.all([
        api.get('/admin/mahasiswa'),
        api.get('/admin/dosen'),
        api.get('/admin/matkul'),
        api.get('/admin/kelas'),
        api.get('/admin/ruangan'),
        api.get('/admin/jadwal'),
        api.get('/admin/asisten')
      ]);

      const zip = new JSZip();

      // Helper to generate sheet array buffer
      const getWorkbookBuffer = (headers, dataRows, sheetName) => {
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      };

      // 1. Students (Mahasiswa)
      const mhsHeaders = ['Nama', 'Stambuk', 'Angkatan', 'Program Studi', 'Email'];
      const mhsRows = mhs.map(m => [
        m.user?.nama || '',
        m.stambuk || '',
        m.angkatan || '',
        m.programStudi || '',
        m.user?.email || ''
      ]);
      zip.file('1_Students.xlsx', getWorkbookBuffer(mhsHeaders, mhsRows, 'Students'));

      // 2. Lecturers (Dosen)
      const dsnHeaders = ['Name', 'NID', 'Email'];
      const dsnRows = dsn.map(d => [
        d.user?.nama || '',
        d.nid || '',
        d.user?.email || ''
      ]);
      zip.file('2_Lecturers.xlsx', getWorkbookBuffer(dsnHeaders, dsnRows, 'Lecturers'));

      // 3. Courses (Mata Kuliah)
      const mkHeaders = ['Code', 'Name', 'Credits', 'Type', 'Description'];
      const mkRows = mk.map(m => [
        m.kode || '',
        m.nama || '',
        m.sks || 2,
        m.tipe === 'keduanya' ? 'both' : m.tipe === 'kuliah' ? 'lecture' : 'practicum',
        m.deskripsi || ''
      ]);
      zip.file('3_Courses.xlsx', getWorkbookBuffer(mkHeaders, mkRows, 'Courses'));

      // 4. Classes (Kelas)
      const klsHeaders = ['Class Name', 'Course Code', 'Lecturer NID', 'Course Name', 'Lecturer Name', 'Total Participants', 'Status'];
      const klsRows = kls.map(k => [
        k.namaKelas || '',
        k.mataKuliah?.kode || '',
        k.dosen?.nid || '',
        k.mataKuliah?.nama || '',
        k.dosen?.user?.nama || '',
        k._count?.pesertaKelas || 0,
        k.aktif ? 'Active' : 'Inactive'
      ]);
      zip.file('4_Classes.xlsx', getWorkbookBuffer(klsHeaders, klsRows, 'Classes'));

      // 5. Lab Rooms (Ruangan/Lab)
      const rngHeaders = ['Room Code', 'Lab Room Name', 'Capacity'];
      const rngRows = rng.map(r => [
        r.kode || '',
        r.nama || '',
        r.kapasitas || ''
      ]);
      zip.file('5_Lab_Rooms.xlsx', getWorkbookBuffer(rngHeaders, rngRows, 'Lab_Rooms'));

      // 6. Schedules (Jadwal)
      const jdwHeaders = ['Course Code', 'Class', 'Room Code', 'Lecturer NID', 'Assistant Stambuk', 'Day', 'Start Time', 'End Time', 'Semester'];
      const jdwRows = jdw.map(j => [
        j.mataKuliah?.kode || '',
        j.kelas || '',
        j.ruangan?.kode || '',
        j.dosen?.nid || '',
        j.asisten?.stambuk || '',
        j.hari || '',
        j.jamMulai || '',
        j.jamSelesai || '',
        j.semester || ''
      ]);
      zip.file('6_Schedules.xlsx', getWorkbookBuffer(jdwHeaders, jdwRows, 'Schedules'));

      // 8. Assistants (Asisten)
      const astHeaders = ['Name', 'Assistant ID (Stambuk)', 'Email', 'Status'];
      const astRows = ast.map(a => [
        a.user?.nama || '',
        a.stambuk || '',
        a.user?.email || '',
        a.user?.aktif ? 'Active' : 'Inactive'
      ]);
      zip.file('8_Assistants.xlsx', getWorkbookBuffer(astHeaders, astRows, 'Assistants'));

      // Generate and trigger download
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Admin_All_Data_Export.zip';
      link.click();
      window.URL.revokeObjectURL(url);

      setSuccess('Successfully exported all admin data to ZIP');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to export admin data');
    } finally {
      setExporting(false);
    }
  };

  const statCards = [
    { label: 'Total Students', value: stats.mahasiswa },
    { label: 'Total Lecturers', value: stats.dosen },
    { label: 'Active Courses', value: stats.matkul },
  ];

  return (
    <DashboardLayout title="Admin Dashboard">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Welcome Back, {user?.nama?.split(' ')[0]}</h1>
          <p className="page-subtitle">Integrated Academic Management System</p>
        </div>
        <div className="flex gap-3">
          <button 
            className="btn btn-ghost" 
            style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }} 
            onClick={handleExportAllData}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export All Data (.zip)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="grid-4 mb-8">
        {statCards.map(card => (
          <div className="stat-card" key={card.label}>
            <div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Quick Access</h3>
        </div>
        <div className="grid-3" style={{ gap: '16px' }}>
          {[
            { href: '/admin/mahasiswa', label: 'Manage Students', desc: 'Student directories & records' },
            { href: '/admin/dosen', label: 'Manage Lecturers', desc: 'Lecturer directories & NIDs' },
            { href: '/admin/asisten', label: 'Manage Assistants', desc: 'Assistant records & status' },
            { href: '/admin/jadwal', label: 'Manage Schedules', desc: 'Practical slots & session times' },
            { href: '/admin/matkul', label: 'Course Management', desc: 'Curriculum structures' },
            { href: '/admin/kelas', label: 'Manage Classes', desc: 'Class details & enrollment' },
            { href: '/admin/ruangan', label: 'Manage Lab Rooms', desc: 'Room capacities & availability' },
            { href: '/admin/absensi', label: 'Attendance Recap', desc: 'Overall attendance logs' },
            { href: '/admin/nilai', label: 'View Grades', desc: 'Detailed student scores' },
          ].map(item => (
            <a key={item.href} href={item.href}
              className="card quick-access-card"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 24px', textDecoration: 'none',
                transition: 'all var(--transition)',
                background: 'var(--surface-soft)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hairline)'}
            >
              <div style={{ flex: 1 }}>
                <div className="quick-access-label">{item.label}</div>
                <div className="quick-access-desc">{item.desc}</div>
              </div>
              <span className="quick-access-arrow">→</span>
            </a>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
