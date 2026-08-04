'use client';

import { Icon } from '@/components/icon';
import Link from 'next/link';
import type { CSSProperties } from 'react';

/**
 * Celebratory order-confirmation screen: a parcel pops in, a sneaker drops
 * into it, a tick badge lands, and confetti bursts — all pure CSS/SVG so there
 * are no GIFs or extra dependencies. Honors `prefers-reduced-motion`.
 */

// Confetti pieces spread evenly around the parcel (deterministic — no random,
// so server and client render identically).
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  const dist = 78 + (i % 3) * 20;
  const colors = ['#b99255', '#171716', '#e9c9a0', '#c0563f'];
  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist),
    r: (i % 2 ? 1 : -1) * (140 + (i % 4) * 40),
    color: colors[i % colors.length]!,
    delay: 260 + (i % 5) * 45,
    size: 6 + (i % 3) * 3,
    round: i % 2 === 0,
  };
});

export function OrderSuccess({ orderNumber }: { orderNumber: string }) {
  return (
    <section className="max-w-[600px] mx-auto pt-[86px] px-[5.25vw] pb-[100px] text-center max-[760px]:pt-[54px]">
      {/* Animation stage */}
      <div className="relative mx-auto mb-[34px] h-[172px] w-[172px]">
        {/* Confetti burst */}
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -ml-[4px] -mt-[4px] opacity-0 animate-[confetti-burst_1.15s_ease-out_forwards] motion-reduce:hidden"
            style={
              {
                width: c.size,
                height: c.size,
                background: c.color,
                borderRadius: c.round ? '9999px' : '2px',
                animationDelay: `${c.delay}ms`,
                '--dx': `${c.dx}px`,
                '--dy': `${c.dy}px`,
                '--r': `${c.r}deg`,
              } as CSSProperties
            }
          />
        ))}

        {/* Parcel */}
        <div className="absolute inset-0 grid place-items-center animate-[box-pop_0.55s_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none">
          <div className="grid h-[150px] w-[150px] place-items-center rounded-[32px] border-2 border-ink bg-accent-soft shadow-[0_16px_34px_rgba(28,22,16,0.16)]">
            <span
              className="block text-[92px] leading-none animate-[shoe-drop_0.7s_cubic-bezier(0.2,0.8,0.2,1)_0.15s_both] motion-reduce:animate-none"
              role="img"
              aria-label="sneaker"
            >
              👟
            </span>
          </div>
        </div>

        {/* Tick badge */}
        <span
          aria-hidden="true"
          className="absolute right-[6px] top-[6px] grid h-[44px] w-[44px] place-items-center rounded-full border-2 border-paper bg-accent text-white shadow-[0_6px_14px_rgba(28,22,16,0.22)] animate-[badge-pop_0.4s_cubic-bezier(0.2,0.8,0.2,1)_0.5s_both] motion-reduce:animate-none"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[22px] w-[22px] [&_path]:[stroke-dasharray:30] [&_path]:animate-[check-draw_0.5s_0.6s_both] motion-reduce:[&_path]:animate-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
      </div>

      {/* Copy */}
      <div className="animate-[rise_0.45s_0.35s_both] motion-reduce:animate-none">
        <p className="m-0 mb-[10px] text-[10px] font-bold uppercase tracking-[.16em] text-accent">
          Order confirmed
        </p>
        <h1 className="m-0 mb-[14px] text-[clamp(38px,5.5vw,58px)] leading-[.82] tracking-[-.09em]">
          Your kicks are <em className="font-[Georgia,serif] font-normal">packed.</em>
        </h1>
        <p className="mb-[4px] text-[13px] text-[#666]">Your order number is</p>
        <p className="text-[18px] font-bold tracking-[-.02em]">{orderNumber}</p>
        <p className="mx-auto mt-[14px] max-w-[360px] text-[12px] leading-[1.6] text-[#666]">
          We&apos;re prepping your pair for dispatch — you&apos;ll get a confirmation the moment it
          ships.
        </p>

        <Link
          className="mt-[26px] inline-flex items-center gap-[15px] rounded-[8px] bg-ink px-[20px] py-[13px] text-[10px] font-bold uppercase tracking-[.08em] text-white no-underline transition-transform duration-200 hover:translate-x-[4px] [&_svg]:w-[14px]"
          href="/"
        >
          Continue shopping <Icon name="arrow" />
        </Link>
      </div>
    </section>
  );
}
