'use client';

import { ApiError, api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/**
 * Keep the name field to letters and spaces only — strips digits, apostrophes,
 * hyphens and every other symbol as the customer types.
 *
 * Combining marks are kept alongside letters: Indic scripts build characters
 * from them ("रीता" is र + ी + त + ा), so stripping \p{M} would mangle most
 * Hindi, Tamil, Bengali and Gujarati names as they are typed.
 */
function sanitizeName(value: string): string {
  return value.replace(/[^\p{L}\p{M} ]/gu, '');
}

/** Digits and a single leading `+` only, capped at a realistic E.164 length. */
function sanitizeMobile(value: string): string {
  const plus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '').slice(0, 15);
  return plus ? `+${digits}` : digits;
}

/** Enough digits to be a plausible number (10 national, or up to 15 with a code). */
function isPlausibleMobile(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Sign in / sign up in two steps, with no password anywhere.
 *
 *   1. Enter a mobile number → the API sends a WhatsApp code and tells us
 *      whether the number is new.
 *   2. Enter the code (plus a name, if the number is new) → signed in.
 *
 * The same two screens serve both cases, which is why there is no "register"
 * mode: a returning customer and a brand-new one take an identical path and the
 * only difference is whether the name field appears.
 */
export function LoginModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [mobileNo, setMobileNo] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const queryClient = useQueryClient();
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Mirror the server's resend cooldown so the button is visibly disabled rather
  // than failing with a "please wait 47s" error the customer can't predict.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Focus the code box as soon as we land on step 2 — on mobile this also brings
  // up the numeric keypad without an extra tap.
  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await api.otpStart(mobileNo);
      setIsNewUser(result.isNewUser);
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'We couldn’t send a code. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      // `name` is only sent for a new number; the API ignores it otherwise and
      // an existing account's name is never overwritten by a sign-in.
      completeAuth(await api.otpVerify(mobileNo, code, isNewUser ? name : undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code didn’t work. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (cooldown > 0) return;
    setError('');
    setResendNotice('');
    try {
      await api.otpResend(mobileNo);
      setResendNotice('A new code is on its way.');
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Couldn’t resend the code. Please try again.',
      );
    }
  }

  function editNumber() {
    setStep('mobile');
    setCode('');
    setError('');
    setResendNotice('');
  }

  function completeAuth(result: { accessToken: string; refreshToken: string; user: unknown }) {
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

  const overlayClass =
    'fixed inset-0 z-50 grid place-items-center p-[20px] bg-[rgba(10,10,10,0.48)] animate-fade max-[700px]:items-end max-[700px]:p-0';
  const panelClass =
    'relative w-[min(100%,430px)] max-h-[calc(100dvh-40px)] overflow-y-auto overscroll-contain px-[39px] pt-[44px] pb-[33px] bg-paper shadow-[0_20px_60px_#0004] animate-panel max-[700px]:w-full max-[700px]:px-[22px] max-[700px]:pt-[36px] max-[700px]:pb-[29px] max-[700px]:max-h-[100dvh] max-[700px]:rounded-t-[18px]';
  const eyebrowClass = 'm-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold';
  const titleClass = 'm-0 text-[43px] leading-[.95] tracking-[-.08em] max-[700px]:text-[37px]';
  const labelClass = 'grid gap-[7px] text-[10px] font-bold tracking-[.08em] uppercase';
  const inputClass =
    'h-[46px] w-full min-w-0 border border-[#c9c8c3] px-[12px] text-[14px] text-ink focus:outline-2 focus:outline-ink focus:outline-offset-1';
  const submitClass =
    'h-[46px] border-0 bg-ink text-white rounded-[8px] uppercase text-[10px] font-bold tracking-[.1em] disabled:opacity-60';

  if (isSuccess) {
    return (
      <div className={overlayClass} onMouseDown={onClose}>
        <section
          className={panelClass}
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
            {isNewUser ? 'Welcome aboard.' : 'You’re in.'}
          </h2>
          <p className="mt-[14px] mb-[8px] text-center text-[13px] leading-[1.5] text-[#686868] animate-rise [animation-delay:0.36s]">
            {isNewUser
              ? 'Account created successfully. Taking you back…'
              : 'Signed in successfully. Taking you back…'}
          </p>
        </section>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className={overlayClass} onMouseDown={onClose}>
        <section
          className={panelClass}
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
          <p className={eyebrowClass}>Verify WhatsApp</p>
          <h2 id="otp-title" className={titleClass}>
            Enter code.
          </h2>
          <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868] break-words">
            We sent a 6-digit code on WhatsApp to{' '}
            <span className="font-bold text-ink break-all">{mobileNo}</span>.
          </p>
          <form onSubmit={verifyCode} className="grid gap-[15px]">
            {isNewUser && (
              <label className={labelClass}>
                Your name
                <input
                  value={name}
                  onChange={(event) => setName(sanitizeName(event.target.value))}
                  required
                  autoComplete="name"
                  placeholder="Full name"
                  className={inputClass}
                />
              </label>
            )}
            <label className={labelClass}>
              Verification code
              <input
                ref={codeInputRef}
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
              disabled={submitting || code.length !== 6 || (isNewUser && !name.trim())}
              className={submitClass}
            >
              {submitting ? 'Verifying…' : isNewUser ? 'Create account' : 'Sign in'}{' '}
              <span className="ml-[23px] text-[16px]">→</span>
            </button>
          </form>
          <p className="mt-[18px] text-[12px] text-[#686868] text-center">
            Didn’t get it?{' '}
            <button
              type="button"
              onClick={resendCode}
              disabled={cooldown > 0}
              className="font-bold text-ink underline underline-offset-2 disabled:no-underline disabled:text-[#a7a7a7]"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </p>
          <p className="mt-[8px] text-[12px] text-[#686868] text-center">
            <button
              type="button"
              onClick={editNumber}
              className="font-bold text-ink underline underline-offset-2"
            >
              Change number
            </button>
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className={overlayClass} onMouseDown={onClose}>
      <section
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="absolute right-[15px] top-[13px] w-[34px] h-[34px] border-0 bg-transparent text-[25px] font-[300]"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <p className={eyebrowClass}>Sign in or sign up</p>
        <h2 id="login-title" className={titleClass}>
          Your number.
        </h2>
        <p className="mt-[14px] mb-[25px] text-[13px] leading-[1.5] text-[#686868]">
          We’ll send a 6-digit code to your WhatsApp. No password needed.
        </p>
        <form onSubmit={requestCode} className="grid gap-[15px]">
          <label className={labelClass}>
            Mobile number
            <input
              value={mobileNo}
              onChange={(event) => setMobileNo(sanitizeMobile(event.target.value))}
              inputMode="tel"
              autoComplete="tel"
              required
              autoFocus
              placeholder="98765 43210"
              className={inputClass}
            />
          </label>
          {error && <p className="m-0 text-[11px] text-[#ae2222]">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !isPlausibleMobile(mobileNo)}
            className={submitClass}
          >
            {submitting ? 'Sending code…' : 'Continue'}{' '}
            <span className="ml-[23px] text-[16px]">→</span>
          </button>
        </form>
        <p className="mt-[18px] text-[12px] leading-[1.5] text-[#686868] text-center">
          Make sure this number has WhatsApp — that’s where the code arrives.
        </p>
      </section>
    </div>
  );
}
