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
      <div className="login-form-container">
        <div className="login-wordmark">M K P</div>
        <h2 className="login-form-title">WELCOME STUDENT</h2>
        <p className="login-form-sub">Authenticate your identity to begin the session</p>

        {error && (
          <div className="alert alert-error mb-4">
            <span>⚠️</span> {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
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
            <label className="form-label" htmlFor="password">Kata Sandi</label>
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
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
