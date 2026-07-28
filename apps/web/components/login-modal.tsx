'use client';

import { api } from '@/lib/api';
import { useState } from 'react';

export function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await api.login(email, password);
      window.localStorage.setItem('prime-kicks-access-token', result.accessToken);
      window.localStorage.setItem('prime-kicks-refresh-token', result.refreshToken);
      window.localStorage.setItem('prime-kicks-user', JSON.stringify(result.user));
      onSuccess?.();
      onClose();
    } catch {
      setError('We couldn’t sign you in with those details.');
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-[20px] bg-[rgba(10,10,10,0.48)] animate-fade max-[700px]:items-end max-[700px]:p-0"
      onMouseDown={onClose}
    >
      <section
        className="relative w-[min(100%,430px)] px-[39px] pt-[44px] pb-[33px] bg-paper shadow-[0_20px_60px_#0004] animate-panel max-[700px]:w-full max-[700px]:px-[22px] max-[700px]:pt-[36px] max-[700px]:pb-[29px] max-[700px]:rounded-t-[18px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-login-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="absolute right-[15px] top-[13px] w-[34px] h-[34px] border-0 bg-transparent text-[25px] font-[300]"
          onClick={onClose}
          aria-label="Close login"
        >
          ×
        </button>
        <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
          Members only
        </p>
        <h2
          id="cart-login-title"
          className="m-0 text-[43px] leading-[.95] tracking-[-.08em] max-[700px]:text-[37px]"
        >
          Welcome back.
        </h2>
        <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868]">
          Sign in to save your selection and manage your bag.
        </p>
        <form onSubmit={submit} className="grid gap-[15px]">
          <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="h-[44px] border border-[#c9c8c3] px-[12px] font-[14px_Arial] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
            />
          </label>
          <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              minLength={8}
              placeholder="••••••••"
              className="h-[44px] border border-[#c9c8c3] px-[12px] font-[14px_Arial] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
            />
          </label>
          {error && <p className="m-0 text-[11px] text-[#ae2222]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="h-[46px] border-0 bg-ink text-white uppercase text-[10px] font-bold tracking-[.1em] disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}{' '}
            <span className="ml-[23px] text-[16px]">→</span>
          </button>
        </form>
      </section>
    </div>
  );
}
