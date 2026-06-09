import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import QRCode from 'qrcode';

export default function PraktikanDashboard() {
  const user = getUser();
  const [profil, setProfil] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [absensi, setAbsensi] = useState({ rekap: { hadir: 0, izin: 0, sakit: 0, alpa: 0 } });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profilData, absensiData] = await Promise.all([
          api.get('/praktikan/profil'),
          api.get('/praktikan/absensi'),
        ]);
        setProfil(profilData);
        setAbsensi(absensiData);

        // Generate QR Code with absolute black-on-white high contrast for maximum elegance
        if (profilData.qrToken) {
          const qr = await QRCode.toDataURL(profilData.qrToken, {
            width: 200, margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          });
          setQrDataUrl(qr);
        }
      } catch (e) { /* silent */ }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const rekap = absensi.rekap;
  const total = Object.values(rekap).reduce((a, b) => a + b, 0);
  const persen = total > 0 ? Math.round((rekap.hadir / total) * 100) : 0;

  return (
    <DashboardLayout title="Student Dashboard">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Hello, {user?.nama?.split(' ')[0]}</h1>
          <p className="page-subtitle">Monitor your academic progress</p>
        </div>
      </div>

      <div className="grid-2 mb-8" style={{ gridTemplateColumns: '1fr 280px' }}>
        {/* Left: Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Attendance Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Attendance Summary</h3>
              <span className="badge badge-status-active">{persen}% Present</span>
            </div>
            <div className="grid-4" style={{ gap: '12px' }}>
              {[
                { label: 'Present', val: rekap.hadir, cls: 'badge-status-active' },
                { label: 'Excused', val: rekap.izin, cls: 'badge-status-inactive' },
                { label: 'Sick', val: rekap.sakit, cls: 'badge-status-inactive' },
                { label: 'Absent', val: rekap.alpa, cls: 'badge-status-inactive' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center', padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-soft)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px' }}>{item.val}</div>
                  <span className={`badge ${item.cls}`} style={{ marginTop: '4px' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Quick Links</h3></div>
            <div className="grid-2" style={{ gap: '10px' }}>
              {[
                { href: '/praktikan/jadwal', label: 'View Schedule' },
                { href: '/praktikan/materi', label: 'View Materials' },
                { href: '/praktikan/nilai', label: 'View Grades' },
                { href: '/praktikan/absensi', label: 'Attendance Recap' },
                { href: '/praktikan/qr', label: 'My QR Code' },
              ].map(item => (
                <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', textDecoration: 'none', color: 'var(--ink)', transition: 'all var(--transition)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--pacific-blue)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontWeight: 500, fontSize: '14px' }}>{item.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Right: QR Card */}
        <div className="qr-card" style={{ alignSelf: 'flex-start' }}>
          <p className="text-label mb-4" style={{ textAlign: 'center' }}>Attendance QR Code</p>
          {loading ? (
            <div className="flex-center" style={{ height: 200 }}><div className="spinner" /></div>
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="qr-card-img" style={{ borderRadius: 'var(--radius-md)' }} />
          ) : (
            <div className="empty-state"><p>QR Code not available</p></div>
          )}
          {profil && (
            <>
              <div className="qr-card-name">{profil.user?.nama}</div>
              <div className="qr-card-stambuk">{profil.stambuk}</div>
            </>
          )}
          <p className="qr-hint">Show this QR code to the assistant during practicum</p>
          {qrDataUrl && (
            <a href={qrDataUrl} download="qr-absensi.png"
              className="btn btn-outline btn-sm"
              style={{ marginTop: '12px', width: '100%', justifyContent: 'center', display: 'flex' }}>
              Download QR
            </a>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
