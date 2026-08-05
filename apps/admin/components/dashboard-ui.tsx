'use client';

import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Compact rupee label for tight spaces (₹1.2L, ₹3.4Cr). */
export function compactCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount);
}

/** A single headline metric tile. */
export function StatCard({
  label,
  value,
  sub,
  tone = 'neutral',
  href,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  href?: string;
  onClick?: () => void;
}) {
  const toneRing: Record<string, string> = {
    neutral: 'border-neutral-200',
    success: 'border-emerald-200 bg-emerald-50/40',
    warning: 'border-amber-200 bg-amber-50/40',
    danger: 'border-red-200 bg-red-50/40',
  };
  const interactive = href || onClick;
  const className = `flex flex-col rounded-xl border ${toneRing[tone]} bg-white p-5 ${
    interactive ? 'cursor-pointer transition-shadow hover:shadow-md' : ''
  }`;
  const body = (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="mt-2 text-2xl font-bold text-neutral-900">{value}</span>
      {sub != null && <span className="mt-1 text-xs text-neutral-500">{sub}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <div onClick={onClick} className={className}>
      {body}
    </div>
  );
}

/** A ▲/▼ percentage change, green when up, red when down. */
export function Delta({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/** Percent change from `prev` to `cur`; null when there's no prior baseline. */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** KPI tile with a value and an optional period-over-period delta. */
export function KpiStat({
  label,
  value,
  deltaPct,
}: {
  label: string;
  value: ReactNode;
  deltaPct?: number | null;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="mt-1.5 text-xl font-bold text-neutral-900">{value}</span>
      {deltaPct !== undefined && (
        <span className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
          <Delta pct={deltaPct ?? null} />
          {deltaPct != null && Number.isFinite(deltaPct) ? 'vs prev' : 'no prior data'}
        </span>
      )}
    </div>
  );
}

/** Compact label/value pair for small stat groups (aging, channel, customers). */
export function MiniStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const toneText: Record<string, string> = {
    neutral: 'text-neutral-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
  };
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
      <div className={`text-lg font-bold ${toneText[tone]}`}>{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{label}</div>
    </div>
  );
}

/** A titled panel wrapper for a chart/list. */
export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Horizontal ranked bars: label, proportional bar, and a right-aligned value. */
export function BarList({
  items,
  emptyMessage = 'No data yet.',
}: {
  items: Array<{ key: string; label: ReactNode; sub?: ReactNode; value: number; display: string }>;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-neutral-400">{emptyMessage}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-neutral-800">{item.label}</span>
            <span className="shrink-0 tabular-nums text-neutral-600">{item.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-neutral-800"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
          {item.sub != null && <div className="mt-0.5 text-xs text-neutral-400">{item.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

/**
 * A compact per-day trend as SVG bars (orders) with a revenue line overlay.
 * Purely presentational — no external chart library.
 */
export function TrendChart({
  data,
}: {
  data: Array<{ date: string; orders: number; revenue: number }>;
}) {
  const W = 720;
  const H = 220;
  const padL = 34; // room for the orders y-axis labels
  const padR = 8;
  const padT = 12;
  const padB = 22; // room for x-axis labels
  const n = Math.max(data.length, 1);
  const maxOrders = niceMax(Math.max(...data.map((d) => d.orders), 1));
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / n;
  const barW = Math.max(slot * 0.62, 2);
  const yOf = (v: number, max: number) => padT + innerH - (v / max) * innerH;

  const points = data
    .map((d, i) => `${(padL + slot * i + slot / 2).toFixed(1)},${yOf(d.revenue, maxRevenue).toFixed(1)}`)
    .join(' ');

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  // Show at most ~8 x-axis labels so they don't collide.
  const labelEvery = Math.ceil(n / 8);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-neutral-800" /> Orders ({totalOrders})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /> Revenue (
          {compactCurrency(totalRevenue)})
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full">
        {/* gridlines + orders axis labels */}
        {gridSteps.map((g) => {
          const y = padT + innerH - g * innerH;
          return (
            <g key={g}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f1ef" strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-neutral-400 text-[9px]">
                {Math.round(maxOrders * g)}
              </text>
            </g>
          );
        })}
        {/* order bars */}
        {data.map((d, i) => {
          const x = padL + slot * i + (slot - barW) / 2;
          const y = yOf(d.orders, maxOrders);
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barW}
              height={Math.max(padT + innerH - y, d.orders > 0 ? 2 : 0)}
              rx={1.5}
              className="fill-neutral-800"
            >
              <title>{`${formatDayLabel(d.date)}: ${d.orders} orders · ${compactCurrency(d.revenue)}`}</title>
            </rect>
          );
        })}
        {/* revenue line */}
        <polyline
          points={points}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* x-axis labels */}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`x-${d.date}`}
              x={padL + slot * i + slot / 2}
              y={H - 6}
              textAnchor="middle"
              className="fill-neutral-400 text-[9px]"
            >
              {formatDayLabel(d.date)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

/** Round a max value up to a clean axis bound (1,2,5 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 5) return Math.ceil(v);
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function formatDayLabel(date?: string): string {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}
