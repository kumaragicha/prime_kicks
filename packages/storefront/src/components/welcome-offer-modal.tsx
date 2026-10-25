'use client';

import { useAuthCart } from '@/lib/hooks';
import { useEffect, useState } from 'react';

// ─── Edit these to change the offer ──────────────────────────────────────────
const OFFER_CODE = 'PRIME200';
const OFFER_TITLE = 'Get ₹200 off';
const OFFER_TEXT = 'Use this code at checkout on your prepaid order.';
/** Delay before the modal opens, in ms. */
const OPEN_DELAY_MS = 2500;
// ─────────────────────────────────────────────────────────────────────────────

/** Shown once per browser session so returning page-views aren't nagged. */
const SEEN_KEY = 'pk_welcome_offer_seen';

export function WelcomeOfferModal() {
  const { user } = useAuthCart();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isReseller = user?.role === 'RESELLER' || process.env.NEXT_PUBLIC_STOREFRONT === 'reseller';

  // Open once per session, a couple of seconds after landing.
  useEffect(() => {
    if (isReseller) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // sessionStorage can throw in private mode — just treat as unseen.
    }
    if (seen) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        // ignore — worst case it reopens on a later navigation
      }
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReseller]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (isReseller || !open) return null;

  const copyCode = () => {
    // Best-effort copy — don't block the close on it (clipboard can reject when
    // the page isn't focused / permission is denied).
    try {
      void navigator.clipboard?.writeText(OFFER_CODE);
    } catch {
      // ignore — the code is visible on screen for manual copy
    }
    setCopied(true);
    // Show the "Copied" feedback briefly, then close the modal.
    window.setTimeout(() => setOpen(false), 900);
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(10,10,10,0.48)] p-[20px] animate-fade max-[700px]:items-end max-[700px]:p-0"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome offer"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-[min(100%,420px)] bg-paper px-[36px] pt-[44px] pb-[36px] text-center shadow-[0_20px_60px_#0004] animate-panel max-[700px]:w-full max-[700px]:rounded-t-[18px] max-[700px]:px-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-[16px] top-[14px] text-[22px] leading-none text-[#999] hover:text-ink"
        >
          ×
        </button>

        <p className="m-0 text-[11px] uppercase tracking-[.18em] text-accent">
          Welcome to Prime Kicks
        </p>
        <h2 className="mt-[10px] mb-[6px] text-[30px] font-bold text-ink">{OFFER_TITLE}</h2>
        <p className="m-0 text-[13px] text-[#666]">{OFFER_TEXT}</p>

        <button
          type="button"
          onClick={copyCode}
          aria-label={`Copy coupon code ${OFFER_CODE}`}
          className="mt-[22px] inline-flex w-full items-center justify-between gap-[10px] rounded-[10px] border border-dashed border-ink bg-paper px-[18px] py-[14px] transition-opacity hover:opacity-80"
        >
          <span className="text-[22px] font-bold tracking-[.18em] text-ink">{OFFER_CODE}</span>
          <span className="rounded-[6px] bg-ink px-[14px] py-[7px] text-[11px] font-bold uppercase tracking-[.1em] text-white">
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-[16px] text-[12px] text-[#999] underline underline-offset-2 hover:text-ink"
        >
          Continue shopping
        </button>
      </div>
    </div>
  );
}
