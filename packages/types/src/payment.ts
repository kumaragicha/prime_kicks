/** How a web customer pays for an order. */
export type PaymentMethod = 'ONLINE' | 'COD';

/** Share of the order total a COD customer pays online up front. */
export const COD_ADVANCE_PERCENT = 20;

/**
 * Split an order total (whole rupees) into what is paid online now and what
 * the courier collects on delivery. ONLINE pays everything now; COD pays the
 * advance (rounded up to the rupee) now and the rest in cash. Shared by the API
 * and the storefront so both always show and charge the same amounts.
 */
export function splitPayment(
  total: number,
  method: PaymentMethod,
): { payNow: number; payOnDelivery: number } {
  if (method === 'ONLINE') return { payNow: total, payOnDelivery: 0 };
  const payNow = Math.min(total, Math.ceil((total * COD_ADVANCE_PERCENT) / 100));
  return { payNow, payOnDelivery: total - payNow };
}
