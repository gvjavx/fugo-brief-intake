import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';

type Session = { state: 'loading' } | { state: 'in'; email: string } | { state: 'out' } | { state: 'error'; message: string };

export function AdminLayout() {
  const [session, setSession] = useState<Session>({ state: 'loading' });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api<{ email: string }>('/auth/me')
      .then(({ email }) => setSession({ state: 'in', email }))
      .catch((err) =>
        setSession(err instanceof ApiError && err.status === 401 ? { state: 'out' } : { state: 'error', message: err.message }),
      );
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    navigate('/login');
  }

  if (session.state === 'loading') return <p className="page-status">Memeriksa sesi…</p>;
  if (session.state === 'error') return <p className="page-status error">{session.message}</p>;
  if (session.state === 'out') return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="admin">
      <header className="admin-bar">
        <Link to="/admin" className="wordmark">
          Fugo <span>Brief Desk</span>
        </Link>
        <div className="admin-bar-user">
          <span className="mono">{session.email}</span>
          <button type="button" className="link-button" onClick={logout}>
            Keluar
          </button>
        </div>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
