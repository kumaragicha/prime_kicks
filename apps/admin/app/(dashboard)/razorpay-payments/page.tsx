'use client';

import { DataTable, Pagination } from '@/components/table-controls';
import { useRazorpayPayments } from '@/lib/hooks';
import { formatCurrency } from '@prime-kicks/utils';
import { type AdminRazorpayPaymentRow } from '@prime-kicks/types';
import { Badge } from '@prime-kicks/ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo, useState } from 'react';

const columnHelper = createColumnHelper<AdminRazorpayPaymentRow>();
const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  CONSUMING: 'warning',
  CONSUMED: 'success',
  REFUNDED: 'danger',
  FAILED: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting payment',
  CONSUMING: 'Processing…',
  CONSUMED: 'Paid',
  REFUNDED: 'Refunded',
  FAILED: 'Failed',
};

/**
 * Read-only ledger of every Razorpay checkout attempt — one row per checkout
 * session, not per Order (web storefront only — reseller/credit orders never
 * go through Razorpay, so they never appear here). An abandoned or failed
 * checkout has no Order ID at all; a REFUNDED row means the payment was
 * captured but the cart could no longer be fulfilled (e.g. an item sold out)
 * and was auto-refunded in full — see the reason shown for those.
 */
export default function RazorpayPaymentsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching } = useRazorpayPayments({
    page,
    pageSize: PAGE_SIZE,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('orderNumber', {
        header: 'Order ID',
        cell: (c) => c.getValue() ?? <span className="text-neutral-400">—</span>,
      }),
      columnHelper.accessor('razorpayOrderId', {
        header: 'Razorpay Order ID',
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      columnHelper.accessor('razorpayPaymentId', {
        header: 'Payment Received',
        cell: (c) =>
          c.getValue() ? (
            <span className="font-mono text-xs">{c.getValue()}</span>
          ) : (
            <span className="text-neutral-400">—</span>
          ),
      }),
      columnHelper.accessor('amount', {
        header: 'Amount',
        cell: (c) => formatCurrency(c.getValue() / 100, c.row.original.currency),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (c) => {
          const row = c.row.original;
          return (
            <div>
              <Badge tone={STATUS_COLORS[row.status] ?? 'neutral'}>
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
              {row.status === 'REFUNDED' && row.refundReason && (
                <p className="mt-1 max-w-[260px] text-xs text-neutral-500">{row.refundReason}</p>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('createdAt', {
        header: 'Date',
        cell: (c) =>
          new Date(c.getValue()).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">
        Razorpay Payments
        {data && (
          <span className="ml-2 text-base font-medium text-neutral-500">({data.meta.total})</span>
        )}
      </h1>

      {isLoading && <p className="text-neutral-500">Loading…</p>}
      {isError && (
        <p className="text-red-600">
          Failed to load. This section is restricted to ADMIN accounts.
        </p>
      )}

      {data && (
        <>
          <DataTable
            table={table}
            isFetching={isFetching}
            emptyMessage="No Razorpay checkout attempts yet."
          />

          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
