'use client';

import { useAuthCart } from '@/lib/hooks';
import { useState } from 'react';

// ─── Edit these to change the bar ────────────────────────────────────────────
const MESSAGES = ['Use PRIME200 for flat ₹200 off'];
/** Coupon code shown with a copy button. Set to '' to hide the code + button. */
const COUPON_CODE = 'PRIME200';
// ─────────────────────────────────────────────────────────────────────────────

export function Announcement() {
  const { user } = useAuthCart();
  const [copied, setCopied] = useState(false);

  // Resellers have their own terms, and the whole reseller app is wholesale —
  // the customer bar is hidden for both.
  if (user?.role === 'RESELLER' || process.env.NEXT_PUBLIC_STOREFRONT === 'reseller') return null;

  const copyCode = () => {
    if (!COUPON_CODE || !navigator.clipboard) return;
    void navigator.clipboard.writeText(COUPON_CODE).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="flex h-[34px] items-center justify-center gap-[14px] bg-[#111] px-3 text-[10px] uppercase tracking-[.07em] text-white max-[800px]:h-[30px] max-[800px]:gap-[10px] max-[800px]:text-[8px]">
      {MESSAGES.map((msg, i) => (
        <span key={msg} className="flex items-center gap-[14px] max-[800px]:gap-[10px]">
          {i > 0 && (
            <span aria-hidden className="opacity-40 max-[520px]:hidden">
              •
            </span>
          )}
          <span className={i > 0 ? 'max-[520px]:hidden' : ''}>{msg}</span>
        </span>
      ))}
      {COUPON_CODE && (
        <button
          type="button"
          onClick={copyCode}
          aria-label={`Copy coupon code ${COUPON_CODE}`}
          className="inline-flex items-center gap-[6px] rounded-full border border-white/50 px-2.5 py-[3px] font-medium transition-opacity hover:opacity-80"
        >
          <span className="tracking-[.12em]">{COUPON_CODE}</span>
          <span className="opacity-70">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      )}
    </div>
  );
}
