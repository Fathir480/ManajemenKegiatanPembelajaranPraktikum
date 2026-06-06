import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import './asisten.css';

export default function KelolaAsisten() {
  const [asisten, setAsisten] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAsisten = async () => {
    try {
      setLoading(true);
      const data = await api.get('/admin/asisten');
      setAsisten(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch assistant data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsisten();
  }, []);

  const handleDemote = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to demote ${name} back to a regular student?`)) return;

    try {
      setError('');
      setSuccess('');
      const res = await api.post('/admin/asisten/demote', { userId });
      setSuccess(res.message || 'Assistant successfully demoted.');
      fetchAsisten();
    } catch (err) {
      setError(err.message || 'Failed to demote assistant.');
    }
  };

  const filteredAsisten = asisten.filter(a =>
    a.user?.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.stambuk?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout title="Manage Assistants">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Assistant Management</h1>
          <p className="page-subtitle">Manage laboratory practicum assistants and oversee assistant account roles.</p>
        </div>
      </div>

      {success && <div className="alert alert-success mb-6">{success}</div>}
      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="card mb-6">
        <div className="asisten-controls">
          <div className="search-input-wrapper">
            <span className="search-icon"></span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search name, stambuk..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-muted text-mono" style={{ fontSize: '12px' }}>
            Showing {filteredAsisten.length} assistants
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
            <div className="spinner" />
            <span className="text-muted text-mono">Processing data...</span>
          </div>
        ) : filteredAsisten.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"></div>
            <p>No assistants found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Assistant ID (Stambuk)</th>
                  <th>Status</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredAsisten.map(a => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.user?.nama}</strong>
                      <br />
                      <span className="text-mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {a.user?.email}
                      </span>
                    </td>
                    <td className="text-mono">{a.stambuk}</td>
                    <td>
                      <span className={`badge ${a.user?.aktif ? 'badge-status-active' : 'badge-status-inactive'}`}>
                        {a.user?.aktif ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-3 justify-end" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="action-icon-btn action-delete" onClick={() => handleDemote(a.user?.id, a.user?.nama)} title="Demote to student">
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
        )}
      </div>
    </DashboardLayout>
  );
}
