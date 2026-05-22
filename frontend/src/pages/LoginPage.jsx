import { useState } from 'react';
import { api } from '../lib/api';
import { setToken, setUser } from '../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      setToken(data.token);
      setUser(data.user);
      // Redirect berdasarkan role
      const role = data.user.role.namaRole;
      const routes = {
        admin: '/admin',
        asisten: '/asisten',
        dosen: '/dosen',
        praktikan: '/praktikan',
      };
      window.location.href = routes[role] || '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Sisi Kiri - Branding */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-name">Manajemen<br />Kegiatan Praktikum</div>
          <div className="login-brand-sub">Sistem Akademik Terpadu</div>
          <p className="login-tagline">
            Platform pengelolaan kegiatan pembelajaran dan praktikum yang terintegrasi untuk dosen, asisten, dan mahasiswa.
          </p>
          <div style={{ marginTop: '40px', display: 'flex', gap: '24px', justifyContent: 'center' }}>
            {[
              { icon: '👨‍🎓', label: 'Mahasiswa' },
              { icon: '👨‍🏫', label: 'Dosen' },
              { icon: '🧑‍💻', label: 'Asisten' },
              { icon: '⚙️', label: 'Admin' },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{item.icon}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sisi Kanan - Form */}
      <div className="login-right">
        <div className="login-form-container">
          <h1 className="login-form-title">Selamat Datang</h1>
          <p className="login-form-sub">Masuk untuk melanjutkan ke dashboard Anda</p>

          {error && (
            <div className="alert alert-error mb-4">
              <span>⚠️</span> {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                id="email"
                className="form-input"
                type="email"
                placeholder="nama@kampus.ac.id"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              id="btn-login"
              type="submit"
              className="btn btn-primary btn-lg w-full"
              style={{ marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Memproses...</>
              ) : 'Masuk'}
            </button>
          </form>

          <p style={{ marginTop: '32px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
            Hubungi administrator jika Anda belum memiliki akun.
          </p>
        </div>
      </div>
    </div>
  );
}
