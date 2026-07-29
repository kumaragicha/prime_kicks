'use client';

import { ApiError, api } from '@/lib/api';
import { useState } from 'react';

const emptyRegister = {
  firstName: '',
  lastName: '',
  email: '',
  mobileNo: '',
  city: '',
  state: '',
  password: '',
};

export function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(emptyRegister);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function updateForm(field: keyof typeof emptyRegister, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleMode() {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setError('');
  }

  function completeAuth(result: {
    accessToken: string;
    refreshToken: string;
    user: unknown;
  }) {
    window.localStorage.setItem('prime-kicks-access-token', result.accessToken);
    window.localStorage.setItem('prime-kicks-refresh-token', result.refreshToken);
    window.localStorage.setItem('prime-kicks-user', JSON.stringify(result.user));
    setIsSuccess(true);
    onSuccess?.();
    setTimeout(() => {
      onClose();
    }, 2000);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'register') {
        completeAuth(await api.register(form));
      } else {
        completeAuth(await api.login(email, password));
      }
    } catch (err) {
      if (mode === 'register') {
        setError(
          err instanceof ApiError ? err.message : 'We couldn’t create your account. Please try again.',
        );
      } else {
        setError('We couldn’t sign you in with those details.');
      }
    } finally {
      setSubmitting(false);
    }
  }
  if (isSuccess) {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center p-[20px] bg-[rgba(10,10,10,0.48)] animate-fade max-[700px]:items-end max-[700px]:p-0"
        onMouseDown={onClose}
      >
        <section
          className="relative w-[min(100%,430px)] px-[39px] pt-[44px] pb-[33px] bg-paper shadow-[0_20px_60px_#0004] animate-panel max-[700px]:w-full max-[700px]:px-[22px] max-[700px]:pt-[36px] max-[700px]:pb-[29px] max-[700px]:rounded-t-[18px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-success-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            className="absolute right-[15px] top-[13px] w-[34px] h-[34px] border-0 bg-transparent text-[25px] font-[300]"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
          <div className="mb-[20px] flex items-center justify-center">
            <span className="grid place-items-center w-[74px] h-[74px] rounded-full bg-accent-soft text-accent animate-check-pop">
              <svg
                className="w-[38px] h-[38px]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  strokeDasharray="30"
                  className="animate-check-draw"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
          </div>
          <p className="m-0 mb-[11px] text-center text-[10px] tracking-[.16em] uppercase font-bold animate-rise [animation-delay:0.2s]">
            Success
          </p>
          <h2
            id="login-success-title"
            className="m-0 text-center text-[43px] leading-[.95] tracking-[-.08em] max-[700px]:text-[37px] animate-rise [animation-delay:0.28s]"
          >
            {mode === 'register' ? 'Welcome aboard.' : 'You’re in.'}
          </h2>
          <p className="mt-[14px] mb-[8px] text-center text-[13px] leading-[1.5] text-[#686868] animate-rise [animation-delay:0.36s]">
            {mode === 'register'
              ? 'Account created successfully. Taking you back…'
              : 'Signed in successfully. Taking you back…'}
          </p>
        </section>
      </div>
    );
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
          {mode === 'login' ? 'Members only' : 'Join Prime Kicks'}
        </p>
        <h2
          id="cart-login-title"
          className="m-0 text-[43px] leading-[.95] tracking-[-.08em] max-[700px]:text-[37px]"
        >
          {mode === 'login' ? 'Welcome back.' : 'Create account.'}
        </h2>
        <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868]">
          {mode === 'login'
            ? 'Sign in to save your selection and manage your bag.'
            : 'Create an account to place orders and track your bag.'}
        </p>
        <form onSubmit={submit} className="grid gap-[15px]">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-[10px]">
                <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
                  First name
                  <input
                    value={form.firstName}
                    onChange={(event) => updateForm('firstName', event.target.value)}
                    autoComplete="given-name"
                    required
                    placeholder="First"
                    className="h-[44px] border border-[#c9c8c3] px-[12px] font-[14px_Arial] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
                  />
                </label>
                <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
                  Last name
                  <input
                    value={form.lastName}
                    onChange={(event) => updateForm('lastName', event.target.value)}
                    autoComplete="family-name"
                    required
                    placeholder="Last"
                    className="h-[44px] border border-[#c9c8c3] px-[12px] font-[14px_Arial] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
                  />
                </label>
              </div>
              <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
                Mobile number
                <input
                  value={form.mobileNo}
                  onChange={(event) => updateForm('mobileNo', event.target.value)}
                  autoComplete="tel"
                  required
                  placeholder="+91 98765 43210"
                  className="h-[44px] border border-[#c9c8c3] px-[12px] font-[14px_Arial] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
                />
              </label>
              <div className="grid grid-cols-2 gap-[10px]">
                <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
                  City
                  <input
                    value={form.city}
                    onChange={(event) => updateForm('city', event.target.value)}
                    autoComplete="address-level2"
                    required
                    placeholder="Mumbai"
                    className="h-[44px] border border-[#c9c8c3] px-[12px] font-[14px_Arial] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
                  />
                </label>
                <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
                  State
                  <input
                    value={form.state}
                    onChange={(event) => updateForm('state', event.target.value)}
                    autoComplete="address-level1"
                    required
                    placeholder="MH"
                    className="h-[44px] border border-[#c9c8c3] px-[12px] font-[14px_Arial] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
                  />
                </label>
              </div>
            </>
          )}
          <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
            Email address
            <input
              type="email"
              value={mode === 'login' ? email : form.email}
              onChange={(event) =>
                mode === 'login' ? setEmail(event.target.value) : updateForm('email', event.target.value)
              }
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
              value={mode === 'login' ? password : form.password}
              onChange={(event) =>
                mode === 'login'
                  ? setPassword(event.target.value)
                  : updateForm('password', event.target.value)
              }
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
            {submitting
              ? mode === 'login'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}{' '}
            <span className="ml-[23px] text-[16px]">→</span>
          </button>
        </form>
        <p className="mt-[18px] text-[12px] text-[#686868] text-center">
          {mode === 'login' ? "Don't have an account? " : 'Already a member? '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-bold text-ink underline underline-offset-2"
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </section>
    </div>
  );
}
