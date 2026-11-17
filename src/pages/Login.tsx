import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/admin';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/login', { method: 'POST', body: { email, password } });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sheet-page">
      <form className="sheet sheet-narrow" onSubmit={submit}>
        <header className="sheet-header">
          <span className="wordmark">Fugo <span>Brief Desk</span></span>
        </header>
        <h1 className="sheet-title">Masuk</h1>
        <div className="field">
          <label className="field-label" htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? 'Memeriksa…' : 'Masuk'}
          </button>
        </div>
      </form>
    </div>
  );
}
