'use client';

import { ApiError, api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Keep name fields to letters and spaces only — strips digits, apostrophes,
 * hyphens and every other symbol as the customer types. Unicode letters are
 * allowed so accented names aren't blocked.
 */
function sanitizeName(value: string): string {
  return value.replace(/[^\p{L} ]/gu, '');
}

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
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(emptyRegister);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // Password-reset ("forgot") step: flips true once the reset email has been requested.
  const [forgotSent, setForgotSent] = useState(false);
  // OTP step: set once registerStart succeeds and we're waiting on the emailed code.
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [code, setCode] = useState('');
  const [resendNotice, setResendNotice] = useState('');
  const queryClient = useQueryClient();

  function updateForm(field: keyof typeof emptyRegister, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleMode() {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setError('');
    setAwaitingOtp(false);
    setCode('');
    setResendNotice('');
  }

  function openForgot() {
    setMode('forgot');
    setError('');
    setForgotSent(false);
  }

  function backToLogin() {
    setMode('login');
    setError('');
    setForgotSent(false);
  }

  async function submitForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.forgotPassword(email);
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      completeAuth(await api.registerVerify(form.email, code));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code didn’t work. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resendOtp() {
    setError('');
    setResendNotice('');
    try {
      await api.registerResend(form.email);
      setResendNotice('A new code is on its way.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t resend the code. Please try again.');
    }
  }

  function completeAuth(result: {
    accessToken: string;
    refreshToken: string;
    user: unknown;
  }) {
    // Persist only the tokens — the user's profile (and role) is always fetched
    // fresh from /auth/me, never cached here, so it can't go stale.
    window.localStorage.setItem('prime-kicks-access-token', result.accessToken);
    window.localStorage.setItem('prime-kicks-refresh-token', result.refreshToken);
    // Prices are resolved server-side from the token, so the catalogue must be
    // refetched under the new identity (a reseller now sees reseller prices).
    void queryClient.invalidateQueries({ queryKey: ['products'] });
    void queryClient.invalidateQueries({ queryKey: ['product'] });
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
        // Step 1: create the pending signup and send the OTP; the account is
        // only created once the code is verified (see `verifyOtp`).
        await api.registerStart(form);
        setAwaitingOtp(true);
      } else {
        completeAuth(await api.login(email, password));
      }
    } catch (err) {
      const fallback =
        mode === 'register'
          ? 'We couldn’t create your account. Please try again.'
          : 'We couldn’t sign you in with those details.';
      setError(err instanceof ApiError ? err.message : fallback);
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
  if (awaitingOtp) {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center p-[20px] bg-[rgba(10,10,10,0.48)] animate-fade max-[700px]:items-end max-[700px]:p-0"
        onMouseDown={onClose}
      >
        <section
          className="relative w-[min(100%,430px)] max-h-[calc(100dvh-40px)] overflow-y-auto overscroll-contain px-[39px] pt-[44px] pb-[33px] bg-paper shadow-[0_20px_60px_#0004] animate-panel max-[700px]:w-full max-[700px]:px-[22px] max-[700px]:pt-[36px] max-[700px]:pb-[29px] max-[700px]:max-h-[100dvh] max-[700px]:rounded-t-[18px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            className="absolute right-[15px] top-[13px] w-[34px] h-[34px] border-0 bg-transparent text-[25px] font-[300]"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
          <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
            Verify email
          </p>
          <h2
            id="otp-title"
            className="m-0 text-[43px] leading-[.95] tracking-[-.08em] max-[700px]:text-[37px]"
          >
            Enter code.
          </h2>
          <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868] break-words">
            We sent a 6-digit code to{' '}
            <span className="font-bold text-ink break-all">{form.email}</span>. Enter it below to
            finish creating your account.
          </p>
          <form onSubmit={verifyOtp} className="grid gap-[15px]">
            <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
              Verification code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="000000"
                className="h-[52px] w-full min-w-0 border border-[#c9c8c3] px-[12px] text-center text-[26px] tracking-[.5em] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
              />
            </label>
            {error && <p className="m-0 text-[11px] text-[#ae2222]">{error}</p>}
            {resendNotice && <p className="m-0 text-[11px] text-accent">{resendNotice}</p>}
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="h-[46px] border-0 bg-ink text-white rounded-[8px] uppercase text-[10px] font-bold tracking-[.1em] disabled:opacity-60"
            >
              {submitting ? 'Verifying…' : 'Verify & create account'}{' '}
              <span className="ml-[23px] text-[16px]">→</span>
            </button>
          </form>
          <p className="mt-[18px] text-[12px] text-[#686868] text-center">
            Didn’t get it?{' '}
            <button
              type="button"
              onClick={resendOtp}
              className="font-bold text-ink underline underline-offset-2"
            >
              Resend code
            </button>
          </p>
          <p className="mt-[8px] text-[12px] text-[#686868] text-center">
            <button
              type="button"
              onClick={() => {
                setAwaitingOtp(false);
                setCode('');
                setError('');
                setResendNotice('');
              }}
              className="font-bold text-ink underline underline-offset-2"
            >
              Edit details
            </button>
          </p>
        </section>
      </div>
    );
  }
  if (mode === 'forgot') {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center p-[20px] bg-[rgba(10,10,10,0.48)] animate-fade max-[700px]:items-end max-[700px]:p-0"
        onMouseDown={onClose}
      >
        <section
          className="relative w-[min(100%,430px)] px-[39px] pt-[44px] pb-[33px] bg-paper shadow-[0_20px_60px_#0004] animate-panel max-[700px]:w-full max-[700px]:px-[22px] max-[700px]:pt-[36px] max-[700px]:pb-[29px] max-[700px]:rounded-t-[18px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            className="absolute right-[15px] top-[13px] w-[34px] h-[34px] border-0 bg-transparent text-[25px] font-[300]"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
          <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
            Password help
          </p>
          <h2
            id="forgot-title"
            className="m-0 text-[43px] leading-[.95] tracking-[-.08em] max-[700px]:text-[37px]"
          >
            {forgotSent ? 'Check your email.' : 'Reset password.'}
          </h2>

          {forgotSent ? (
            <>
              <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868] break-words">
                If an account exists for{' '}
                <span className="font-bold text-ink break-all">{email}</span>, we&apos;ve sent a
                link to reset your password. It expires in 30 minutes.
              </p>
              <button
                type="button"
                onClick={backToLogin}
                className="h-[46px] w-full border-0 bg-ink text-white rounded-[8px] uppercase text-[10px] font-bold tracking-[.1em]"
              >
                Back to sign in <span className="ml-[23px] text-[16px]">→</span>
              </button>
            </>
          ) : (
            <>
              <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868]">
                Enter your email and we&apos;ll send you a link to set a new password.
              </p>
              <form onSubmit={submitForgot} className="grid gap-[15px]">
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
                {error && <p className="m-0 text-[11px] text-[#ae2222]">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-[46px] border-0 bg-ink text-white rounded-[8px] uppercase text-[10px] font-bold tracking-[.1em] disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Send reset link'}{' '}
                  <span className="ml-[23px] text-[16px]">→</span>
                </button>
              </form>
            </>
          )}
          <p className="mt-[18px] text-[12px] text-[#686868] text-center">
            Remembered it?{' '}
            <button
              type="button"
              onClick={backToLogin}
              className="font-bold text-ink underline underline-offset-2"
            >
              Sign in
            </button>
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
                    onChange={(event) => updateForm('firstName', sanitizeName(event.target.value))}
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
                    onChange={(event) => updateForm('lastName', sanitizeName(event.target.value))}
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
            {mode === 'login' ? 'Email or mobile number' : 'Email address'}
            <input
              type={mode === 'login' ? 'text' : 'email'}
              value={mode === 'login' ? email : form.email}
              onChange={(event) =>
                mode === 'login' ? setEmail(event.target.value) : updateForm('email', event.target.value)
              }
              autoComplete={mode === 'login' ? 'username' : 'email'}
              required
              placeholder={mode === 'login' ? 'you@example.com or 9876543210' : 'you@example.com'}
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
          {mode === 'login' && (
            <button
              type="button"
              onClick={openForgot}
              className="justify-self-end -mt-[6px] text-[11px] text-[#686868] hover:text-ink underline underline-offset-2"
            >
              Forgot password?
            </button>
          )}
          {error && <p className="m-0 text-[11px] text-[#ae2222]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="h-[46px] border-0 bg-ink text-white rounded-[8px] uppercase text-[10px] font-bold tracking-[.1em] disabled:opacity-60"
          >
            {submitting
              ? mode === 'login'
                ? 'Signing in…'
                : 'Sending code…'
              : mode === 'login'
                ? 'Sign in'
                : 'Continue'}{' '}
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
