import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import QRCode from 'qrcode';
import './qr.css';

export default function PraktikanQR() {
  const user = getUser();
  const [profil, setProfil] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfil = async () => {
      try {
        setLoading(true);
        const data = await api.get('/praktikan/profil');
        setProfil(data);
        
        if (data.qrToken) {
          const qr = await QRCode.toDataURL(data.qrToken, {
            width: 280,
            margin: 2,
            color: { dark: '#0fa3b1', light: '#ffffff' }
          });
          setQrDataUrl(qr);
        }
      } catch (err) {
        setError('Gagal memuat profil QR Code');
      } finally {
        setLoading(false);
      }
    };
    fetchProfil();
  }, []);

  return (
    <DashboardLayout title="QR Code Absensi">
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ fontSize: '28px' }}>QR Code Kehadiran</h1>
          <p className="page-subtitle">Tunjukkan kode QR unik ini ke asisten praktikum untuk merekam presensi sesi secara instan</p>
        </div>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <div className="qr-page-container">
        <div className="qr-card" style={{ maxWidth: '360px', padding: '32px' }}>
          <p className="text-label mb-6" style={{ textAlign: 'center', fontSize: '12px' }}>
            Kartu Presensi Praktikan
          </p>

          {loading ? (
            <div className="flex-center" style={{ height: '280px' }}><div className="spinner" /></div>
          ) : qrDataUrl ? (
            <img 
              src={qrDataUrl} 
              alt="QR Code Absensi" 
              className="qr-card-img" 
              style={{ width: '240px', height: '240px', borderRadius: 'var(--radius-md)', margin: '0 auto var(--space-6)' }}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📱</div>
              <p>QR Code gagal dimuat</p>
            </div>
          )}

          {profil && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <div className="qr-card-name" style={{ fontSize: '20px', fontWeight: '500' }}>
                {profil.user?.nama}
              </div>
              <div className="qr-card-stambuk" style={{ fontSize: '14px', letterSpacing: '1px', marginTop: '4px' }}>
                Stambuk: {profil.stambuk}
              </div>
              <p className="text-muted text-mono" style={{ fontSize: '11px', marginTop: '8px' }}>
                📚 {profil.programStudi || '-'} | Angkatan {profil.angkatan}
              </p>
            </div>
          )}

          {qrDataUrl && (
            <a 
              href={qrDataUrl} 
              download={`QR_Absensi_${user?.nama?.replace(/\s+/g, '_')}.png`}
              className="btn btn-primary"
              style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}
            >
              📥 Unduh QR Code (.png)
            </a>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
