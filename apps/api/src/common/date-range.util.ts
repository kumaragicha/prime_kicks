/**
 * Date-range filtering helpers shared across modules (orders, audit log).
 *
 * The business timezone is IST (UTC+5:30). Timestamps are stored in UTC, so a
 * calendar day the user picks in the admin (e.g. "Aug 4") must be translated to
 * the UTC instant range that corresponds to that IST day — otherwise orders
 * placed in the early IST hours (which fall on the previous UTC day) are
 * dropped from the filter.
 */

/** IST is UTC+5:30. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** Matches a bare calendar date like "2026-08-04" (no time component). */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve a user-supplied date/datetime string to the UTC instant for one edge
 * of the range:
 *  - A bare "YYYY-MM-DD" expands to the IST start (00:00:00.000) or end
 *    (23:59:59.999) of that day, converted to the equivalent UTC instant.
 *  - A full datetime string is honoured exactly as given.
 *
 * Returns null when the value is empty or unparseable.
 */
export function resolveRangeBoundary(
  value: string | undefined | null,
  edge: 'start' | 'end',
): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (DATE_ONLY.test(trimmed)) {
    const parts = trimmed.split('-').map(Number);
    const y = parts[0]!;
    const m = parts[1]!;
    const d = parts[2]!;
    const wallClockAsUtc =
      edge === 'start'
        ? Date.UTC(y, m - 1, d, 0, 0, 0, 0)
        : Date.UTC(y, m - 1, d, 23, 59, 59, 999);
    return new Date(wallClockAsUtc - IST_OFFSET_MINUTES * 60_000);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Build a Prisma `{ gte?, lte? }` createdAt filter from optional from/to
 * strings. Returns undefined when neither bound is set, so callers can spread
 * it conditionally.
 */
export function buildCreatedAtRange(
  from: string | undefined | null,
  to: string | undefined | null,
): { gte?: Date; lte?: Date } | undefined {
  const gte = resolveRangeBoundary(from, 'start');
  const lte = resolveRangeBoundary(to, 'end');
  if (!gte && !lte) return undefined;
  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {}),
  };
}

/** The IST calendar date (YYYY-MM-DD) an instant falls on. */
export function istDateKey(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** The UTC { gte, lte } bounds of the IST day that contains `instant`. */
export function istDayBounds(instant: Date): { gte: Date; lte: Date } {
  const key = istDateKey(instant);
  return {
    gte: resolveRangeBoundary(key, 'start')!,
    lte: resolveRangeBoundary(key, 'end')!,
  };
}

/**
 * The last `days` IST calendar dates ending today (inclusive), oldest first,
 * as YYYY-MM-DD keys — plus the UTC instant the window starts at. Used to build
 * a per-day trend with no gaps even on days with zero orders.
 */
export function istRecentDays(now: Date, days: number): { keys: string[]; since: Date } {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(istDateKey(new Date(now.getTime() - i * 24 * 60 * 60_000)));
  }
  return { keys, since: resolveRangeBoundary(keys[0]!, 'start')! };
}
