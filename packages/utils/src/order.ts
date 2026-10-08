/**
 * Display form of an order's ID. New orders are plain sequential numbers
 * ("1", "2", …) and are shown as "#1"; older orders keep their original
 * reference ("ORD-…", "PK-…") unchanged.
 */
export function formatOrderId(orderNumber: string): string {
  return /^\d+$/.test(orderNumber) ? `#${orderNumber}` : orderNumber;
}
