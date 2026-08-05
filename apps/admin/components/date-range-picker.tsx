'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/** Local YYYY-MM-DD (no timezone shift, unlike toISOString). */
function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): Date | null {
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function fmt(key: string): string {
  const d = parseKey(key);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}

/**
 * Single-control date range picker: a button showing the selected range that
 * opens a calendar popover. Click a start date, then an end date. Emits local
 * YYYY-MM-DD strings (empty string = cleared).
 */
export function DateRangePicker({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  // The month currently shown in the calendar grid.
  const [viewMonth, setViewMonth] = useState(() => parseKey(start) ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    return cells;
  }, [viewMonth]);

  const startDate = parseKey(start);
  const endDate = parseKey(end);

  const pick = (d: Date) => {
    const key = toKey(d);
    // No start yet, or a complete range exists → begin a new range.
    if (!start || (start && end)) {
      onChange({ start: key, end: '' });
      return;
    }
    // Have a start, picking the end. If earlier than start, swap.
    if (startDate && d < startDate) {
      onChange({ start: key, end: start });
    } else {
      onChange({ start, end: key });
    }
    setOpen(false);
  };

  const inRange = (d: Date) => {
    if (!startDate) return false;
    const hi = endDate ?? startDate;
    const lo = startDate;
    return d >= lo && d <= hi;
  };

  const isEdge = (d: Date) =>
    (startDate && toKey(d) === toKey(startDate)) || (endDate && toKey(d) === toKey(endDate));

  const label =
    start && end
      ? `${fmt(start)} – ${fmt(end)}`
      : start
        ? `${fmt(start)} – …`
        : 'All dates';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:border-neutral-400 focus:border-neutral-900 focus:outline-none"
      >
        <CalendarIcon />
        <span className={start ? 'text-neutral-900' : 'text-neutral-500'}>{label}</span>
        {start && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date range"
            className="ml-1 rounded-full px-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ start: '', end: '' });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onChange({ start: '', end: '' });
              }
            }}
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-neutral-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              className="rounded p-1 hover:bg-neutral-100"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <span className="text-sm font-semibold">
              {viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              aria-label="Next month"
              className="rounded p-1 hover:bg-neutral-100"
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-neutral-400">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
            {days.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const edge = isEdge(d);
              const range = inRange(d);
              return (
                <button
                  key={toKey(d)}
                  type="button"
                  onClick={() => pick(d)}
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    edge
                      ? 'bg-neutral-900 font-medium text-white'
                      : range
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2">
            <button
              type="button"
              className="text-xs text-neutral-500 hover:text-neutral-900"
              onClick={() => onChange({ start: '', end: '' })}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-xs font-medium text-neutral-900 hover:underline"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
