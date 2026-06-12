import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';

const typeMap = {
  'praktikum': 'Practicum',
  'teori': 'Theory',
  'keduanya': 'Both'
};

export default function DosenDashboard() {
  const user = getUser();
  const [matkul, setMatkul] = useState([]);

  useEffect(() => {
    api.get('/dosen/matkul').then(setMatkul).catch(() => {});
  }, []);

  return (
    <DashboardLayout title="Lecturer Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Lecturer Dashboard</h1>
          <p className="page-subtitle">Manage your grades, materials, and teaching schedule</p>
        </div>
      </div>

      <div className="grid-4 mb-8">
        <div className="stat-card">
          <div>
            <div className="stat-label">Assigned Courses</div>
            <div className="stat-value">{matkul.length}</div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Assigned Courses</h3>
        </div>
        {matkul.length === 0 ? (
          <div className="empty-state"><p>No assigned courses yet</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Credits</th>
                  <th>Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {matkul.map(mk => (
                  <tr key={mk.id}>
                    <td className="text-mono">{mk.kode}</td>
                    <td><strong>{mk.nama}</strong></td>
                    <td>{mk.sks}</td>
                    <td>
                      <span className="badge badge-status-active">
                        {typeMap[mk.tipe] || mk.tipe}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={`/dosen/nilai?mk=${mk.id}`} className="btn btn-outline btn-sm">Grades</a>
                        <a href={`/dosen/materi?mk=${mk.id}`} className="btn btn-ghost btn-sm">Materials</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-3">
        {[
          { href: '/dosen/nilai', label: 'Grades', desc: 'Manage grades and input UTS/UAS' },
          { href: '/dosen/materi', label: 'Upload Material', desc: 'Upload modules, slides, and references' },
        ].map(item => (
          <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--hairline)', textDecoration: 'none', transition: 'all var(--transition)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--pacific-blue)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.transform = 'none'; }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>{item.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{item.desc}</div>
            </div>
          </a>
        ))}
      </div>
    </DashboardLayout>
  );
}
