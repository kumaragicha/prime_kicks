/**
 * Format an amount in whole rupees into a localized string.
 */
export function formatCurrency(
  amountRupees: number,
  currency = 'INR',
  locale = 'en-IN',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amountRupees);
}

/** Normalize a rupee price to a whole number. */
export function toRupees(amount: number): number {
  return Math.round(amount);
}
