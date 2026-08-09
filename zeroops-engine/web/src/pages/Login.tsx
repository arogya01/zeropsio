import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMe, login, signup } from '../api/client';

export function Login() {
  const nav = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMe().then((d) => {
      if (d.user) nav('/studio', { replace: true });
    });
  }, [nav]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = isSignup
        ? await signup(email, password, name)
        : await login(email, password);
      if (data.success) nav('/studio');
      else setError(data.error || 'Auth failed');
    } catch {
      setError('Connection error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-12 items-center justify-between border-b border-zo-line-2 px-5">
        <Link to="/" className="flex items-center gap-2.5 text-[13px] font-semibold no-underline">
          <span className="zo-mark">Z</span>
          ZeroOps
        </Link>
        <Link to="/" className="text-[13px] text-zo-muted no-underline hover:text-zo-text">
          ← Overview
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-[400px] rounded-sm border border-zo-line bg-zo-surface p-6">
          <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mb-5 text-[13px] leading-relaxed text-zo-muted">
            Session auth only. After login you attach a Zerops PAT; deploys run as that account via{' '}
            <code>zcli</code>.
          </p>

          {error ? (
            <div
              role="alert"
              className="mb-3 border border-zo-fail/40 bg-zo-fail/10 px-2.5 py-2 font-mono text-xs text-zo-fail"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3">
            {isSignup ? (
              <div>
                <label className="zo-label" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  className="zo-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            ) : null}
            <div>
              <label className="zo-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="zo-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="zo-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="zo-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </div>
            <button type="submit" disabled={busy} className="zo-btn zo-btn-primary mt-1 w-full">
              {busy ? '…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-[13px] text-zo-dim">
            {isSignup ? 'Have an account?' : 'No account?'}{' '}
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-zo-text underline underline-offset-2"
              onClick={() => {
                setIsSignup((v) => !v);
                setError('');
              }}
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>

          <p className="mt-5 border-t border-zo-line-2 pt-4 font-mono text-[11px] leading-relaxed text-zo-dim">
            Next in Studio: paste PAT from
            <br />
            app.zerops.io → token management
          </p>
        </div>
      </div>
    </div>
  );
}
