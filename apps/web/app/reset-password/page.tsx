'use client';

import { ApiError, api } from '@/lib/api';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grid place-items-center bg-paper">
          <i className="w-[18px] h-[18px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />
        </main>
      }
    >
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'We couldn’t reset your password. Please request a new link.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function goSignIn() {
    // Signal the home page to pop the login modal open.
    window.localStorage.setItem('prime-kicks-open-login', 'true');
    router.push('/');
  }

  return (
    <main className="min-h-screen grid place-items-center bg-[#efece6] p-[20px]">
      <section className="relative w-[min(100%,430px)] px-[39px] pt-[44px] pb-[33px] bg-paper shadow-[0_20px_60px_#0004] max-[700px]:px-[22px]">
        <div className="mb-[22px]">
          <span className="text-[20px] tracking-[-.02em] font-bold italic">PRIME</span>
          <span className="text-[20px] tracking-[.02em]">&nbsp;KICKS</span>
        </div>

        {!token ? (
          <>
            <h1 className="m-0 text-[38px] leading-[.95] tracking-[-.08em]">Invalid link.</h1>
            <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868]">
              This password-reset link is missing its token. Please request a new one from the sign-in
              screen.
            </p>
            <Link
              href="/"
              className="inline-flex h-[46px] w-full items-center justify-center bg-ink text-white uppercase text-[10px] font-bold tracking-[.1em]"
            >
              Back to store
            </Link>
          </>
        ) : done ? (
          <>
            <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">Success</p>
            <h1 className="m-0 text-[43px] leading-[.95] tracking-[-.08em]">Password updated.</h1>
            <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868]">
              Your password has been changed. You can now sign in with your new password.
            </p>
            <button
              type="button"
              onClick={goSignIn}
              className="h-[46px] w-full border-0 bg-ink text-white uppercase text-[10px] font-bold tracking-[.1em]"
            >
              Sign in <span className="ml-[23px] text-[16px]">→</span>
            </button>
          </>
        ) : (
          <>
            <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
              Password reset
            </p>
            <h1 className="m-0 text-[43px] leading-[.95] tracking-[-.08em]">Set a new one.</h1>
            <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868]">
              Choose a new password for your Prime Kicks account.
            </p>
            <form onSubmit={submit} className="grid gap-[15px]">
              <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="h-[44px] border border-[#c9c8c3] px-[12px] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
                />
              </label>
              <label className="grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase">
                Confirm password
                <input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="h-[44px] border border-[#c9c8c3] px-[12px] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1"
                />
              </label>
              {error && <p className="m-0 text-[11px] text-[#ae2222]">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="h-[46px] border-0 bg-ink text-white uppercase text-[10px] font-bold tracking-[.1em] disabled:opacity-60"
              >
                {submitting ? 'Updating…' : 'Update password'}{' '}
                <span className="ml-[23px] text-[16px]">→</span>
              </button>
            </form>
            <p className="mt-[18px] text-[12px] text-[#686868] text-center">
              <Link href="/" className="font-bold text-ink underline underline-offset-2">
                Back to store
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
