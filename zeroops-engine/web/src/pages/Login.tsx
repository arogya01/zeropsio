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
    <div className="flex min-h-full flex-col bg-surface-base">
      <header className="flex h-14 items-center justify-between border-b border-black/[0.08] bg-surface-white/80 px-7 backdrop-blur-[12px]">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-[16px] font-medium leading-6 text-text-primary no-underline"
        >
          <span className="zo-mark">Z</span>
          ZeroOps
        </Link>
        <Link
          to="/"
          className="text-[16px] font-medium leading-6 text-text-medium no-underline hover:text-text-primary"
        >
          ← Overview
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-7 py-12">
        <div className="w-full max-w-[400px] rounded-card border border-black/[0.08] bg-surface-white p-8">
          <h1 className="m-0 mb-2 text-[20px] font-semibold leading-7 tracking-[-0.125px] text-text-primary">
            Sign in
          </h1>
          <p className="mb-6 text-[16px] leading-6 text-text-medium">
            Session auth only. After login you attach a Zerops PAT; deploys run as that account via{' '}
            <code>zcli</code>.
          </p>

          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-card border border-accent-red/30 bg-accent-red/10 px-3 py-2.5 text-[14px] font-medium leading-5 text-accent-red"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
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
            <button type="submit" disabled={busy} className="zo-btn zo-btn-primary mt-2 w-full">
              {busy ? '…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-[14px] font-medium leading-5 text-text-muted">
            {isSignup ? 'Have an account?' : 'No account?'}{' '}
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 font-medium text-text-primary underline underline-offset-2 hover:text-brand-blue"
              onClick={() => {
                setIsSignup((v) => !v);
                setError('');
              }}
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>

          <p className="mt-6 border-t border-black/[0.08] pt-5 font-mono text-[12px] leading-4 text-text-muted">
            Next in Studio: paste PAT from
            <br />
            app.zerops.io → token management
          </p>
        </div>
      </div>
    </div>
  );
}
