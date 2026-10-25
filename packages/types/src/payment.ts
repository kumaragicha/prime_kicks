/** How a web customer pays for an order. */
export type PaymentMethod = 'ONLINE' | 'COD';

/** Courier cash-handling charge for each shoe in a cash-on-delivery order. */
export const COD_CASH_HANDLING_FEE = 300;

/** Calculate the COD courier fee from the total number of shoes ordered. */
export function calculateCodCashHandlingFee(shoeCount: number): number {
  return Math.max(0, Math.floor(shoeCount)) * COD_CASH_HANDLING_FEE;
}

/**
 * Split an order total (whole rupees) into what is paid online now and what
 * the courier collects on delivery. ONLINE pays everything now. COD charges a
 * courier cash-handling fee through Razorpay, then the courier
 * collects the remaining shoe amount at delivery. The caller must include
 * COD_CASH_HANDLING_FEE in the COD total before calling this.
 */
export function splitPayment(
  total: number,
  method: PaymentMethod,
  codCashHandlingFee = COD_CASH_HANDLING_FEE,
): { payNow: number; payOnDelivery: number } {
  if (method === 'ONLINE') return { payNow: total, payOnDelivery: 0 };
  const payNow = Math.min(total, codCashHandlingFee);
  return { payNow, payOnDelivery: total - payNow };
}
