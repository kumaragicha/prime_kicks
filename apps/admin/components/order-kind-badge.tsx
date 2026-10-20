import type { OrderKind } from '@prime-kicks/types';
import { Badge } from '@prime-kicks/ui';

/** Admin-facing name and short explanation for each order type. */
export const ORDER_KIND_INFO: Record<OrderKind, { label: string; hint: string }> = {
  PREPAID: { label: 'Prepaid', hint: 'Customer paid online in full' },
  COD: { label: 'COD', hint: 'Advance paid online, balance in cash on delivery' },
  RESELLER: { label: 'Reseller', hint: 'Reseller order at reseller pricing' },
  CREDIT: { label: 'Credit (bulk)', hint: 'Bulk order billed to a credit customer' },
  CUSTOMER: { label: 'Customer', hint: 'Customer order without a recorded payment method' },
};

/** Filter options for the orders list (CUSTOMER is legacy-only, not offered). */
export const ORDER_KIND_FILTERS: Array<{ value: Exclude<OrderKind, 'CUSTOMER'>; label: string }> = [
  { value: 'PREPAID', label: 'Prepaid (online)' },
  { value: 'COD', label: 'Cash on delivery' },
  { value: 'RESELLER', label: 'Reseller' },
  { value: 'CREDIT', label: 'Credit (bulk)' },
];

export function OrderKindBadge({ kind }: { kind: OrderKind | undefined }) {
  // Defensive: an older API response may not include the type yet.
  const safeKind: OrderKind = kind && kind in ORDER_KIND_INFO ? kind : 'CUSTOMER';
  const { label, hint } = ORDER_KIND_INFO[safeKind];
  switch (safeKind) {
    case 'PREPAID':
      return (
        <Badge tone="success" title={hint}>
          {label}
        </Badge>
      );
    case 'COD':
      return (
        <Badge tone="warning" title={hint}>
          {label}
        </Badge>
      );
    case 'RESELLER':
      return (
        <Badge title={hint} className="!bg-purple-100 !text-purple-800">
          {label}
        </Badge>
      );
    case 'CREDIT':
      return (
        <Badge tone="blue" title={hint}>
          {label}
        </Badge>
      );
    default:
      return <Badge title={hint}>{label}</Badge>;
  }
}
