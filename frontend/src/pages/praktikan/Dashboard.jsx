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

        // Generate QR dari qrToken statis mahasiswa
        if (profilData.qrToken) {
          const qr = await QRCode.toDataURL(profilData.qrToken, {
            width: 200, margin: 2,
            color: { dark: '#0fa3b1', light: '#ffffff' },
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
    <DashboardLayout title="Dashboard Praktikan">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>Halo, {user?.nama?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">Pantau perkembangan akademik Anda</p>
        </div>
      </div>

      <div className="grid-2 mb-8" style={{ gridTemplateColumns: '1fr 280px' }}>
        {/* Kiri: Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Absensi Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Rekap Kehadiran</h3>
              <span className="badge badge-hadir">{persen}% Hadir</span>
            </div>
            <div className="grid-4" style={{ gap: '12px' }}>
              {[
                { label: 'Hadir', val: rekap.hadir, cls: 'badge-hadir', icon: '✅' },
                { label: 'Izin', val: rekap.izin, cls: 'badge-izin', icon: '📋' },
                { label: 'Sakit', val: rekap.sakit, cls: 'badge-sakit', icon: '🏥' },
                { label: 'Alpa', val: rekap.alpa, cls: 'badge-alpa', icon: '❌' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center', padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-soft)' }}>
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>{item.icon}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px' }}>{item.val}</div>
                  <span className={`badge ${item.cls}`} style={{ marginTop: '4px' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Menu Cepat</h3></div>
            <div className="grid-2" style={{ gap: '10px' }}>
              {[
                { href: '/praktikan/jadwal', icon: '🗓️', label: 'Lihat Jadwal' },
                { href: '/praktikan/nilai', icon: '🏆', label: 'Lihat Nilai' },
                { href: '/praktikan/absensi', icon: '✔️', label: 'Rekap Absensi' },
                { href: '/praktikan/qr', icon: '📱', label: 'QR Code Saya' },
              ].map(item => (
                <a key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', textDecoration: 'none', color: 'var(--ink)', transition: 'all var(--transition)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--pacific-blue)'; e.currentTarget.style.background = 'var(--pacific-blue-light)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline)'; e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <span style={{ fontWeight: 500, fontSize: '14px' }}>{item.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Kanan: QR Card */}
        <div className="qr-card" style={{ alignSelf: 'flex-start' }}>
          <p className="text-label mb-4" style={{ textAlign: 'center' }}>QR Code Absensi</p>
          {loading ? (
            <div className="flex-center" style={{ height: 200 }}><div className="spinner" /></div>
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="qr-card-img" style={{ borderRadius: 'var(--radius-md)' }} />
          ) : (
            <div className="empty-state"><div className="empty-state-icon">📱</div><p>QR belum tersedia</p></div>
          )}
          {profil && (
            <>
              <div className="qr-card-name">{profil.user?.nama}</div>
              <div className="qr-card-stambuk">{profil.stambuk}</div>
            </>
          )}
          <p className="qr-hint">Tunjukkan QR ini ke asisten saat praktikum berlangsung</p>
          {qrDataUrl && (
            <a href={qrDataUrl} download="qr-absensi.png"
              className="btn btn-outline btn-sm"
              style={{ marginTop: '12px', width: '100%', justifyContent: 'center', display: 'flex' }}>
              ⬇ Unduh QR
            </a>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
