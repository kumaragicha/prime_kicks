/**
 * Single source of truth for the legal business details shown in the footer,
 * on the contact page, and across the compliance pages (privacy, terms,
 * refund). Every value is read from a NEXT_PUBLIC_* env var so the real,
 * legally-accurate details live in one place (.env) and are never hard-coded.
 *
 * Each field falls back to a clearly-marked [PLACEHOLDER: …] string so an
 * unfilled value is obvious on the page and in a compliance review — it is NOT
 * a real or invented value. Fill these in .env before going live:
 *
 *   NEXT_PUBLIC_BUSINESS_NAME      Registered legal business name
 *   NEXT_PUBLIC_BUSINESS_ADDRESS   Registered business address
 *   NEXT_PUBLIC_BUSINESS_EMAIL     Support / grievance email
 *   NEXT_PUBLIC_BUSINESS_SOURCING  Sourcing / supply channel statement
 */
export const business = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || '[PLACEHOLDER: Registered legal business name]',
  address:
    process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '[PLACEHOLDER: Registered business address]',
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL || '[PLACEHOLDER: Support / grievance email]',
  sourcing:
    process.env.NEXT_PUBLIC_BUSINESS_SOURCING ||
    '[PLACEHOLDER: supplier / authorised sourcing channel]',
} as const;

/** True when a field still holds its placeholder (unfilled). */
export function isPlaceholder(value: string): boolean {
  return value.startsWith('[PLACEHOLDER:');
}
