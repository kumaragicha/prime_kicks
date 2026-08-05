'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import type { PaymentPendingUser } from '@/lib/api';
import { usePaymentPending, useSettlePayment } from '@/lib/hooks';
import { SettleButton } from '@/components/settle-button';
import { useToast } from '@/lib/toast';
import { formatCurrency } from '@prime-kicks/utils';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PaymentsPage() {
  const router = useRouter();
  const { data, isLoading, isError } = usePaymentPending();
  const settle = useSettlePayment();
  const toast = useToast();
  const [toSettle, setToSettle] = useState<PaymentPendingUser | null>(null);

  const totalPending = data?.reduce((sum, u) => sum + u.totalPending, 0) ?? 0;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Payment Pending</h1>
        {data && data.length > 0 && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Total pending</p>
            <p className="text-2xl font-bold text-neutral-900">{formatCurrency(totalPending)}</p>
          </div>
        )}
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Customers with approved orders awaiting payment (dispatched on credit). Open a customer to
        see their orders, or settle everything at once.
      </p>

      {isLoading && <p className="text-neutral-500">Loading…</p>}
      {isError && <p className="text-red-600">Failed to load. Is the API running on port 4000?</p>}
      {data && data.length === 0 && (
        <p className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          No pending payments — everything is settled.
        </p>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((u) => (
            <div
              key={u.userId}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/payments/${u.userId}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') router.push(`/payments/${u.userId}`);
              }}
              className="group flex cursor-pointer flex-col rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900">{u.userName}</p>
                  <p className="text-xs text-neutral-500">
                    {u.orderCount} pending {u.orderCount === 1 ? 'order' : 'orders'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  Pending
                </span>
              </div>

              <p className="mt-4 text-2xl font-bold text-neutral-900">
                {formatCurrency(u.totalPending)}
              </p>
              <p className="text-xs text-neutral-500">outstanding</p>

              <SettleButton
                className="mt-4 w-full"
                disabled={settle.isPending}
                onClick={(e) => {
                  // Don't let the button click also navigate the card.
                  e.stopPropagation();
                  setToSettle(u);
                }}
              />
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toSettle !== null}
        title="Mark all as received?"
        description={
          toSettle
            ? `Mark all ${toSettle.orderCount} pending ${toSettle.orderCount === 1 ? 'order' : 'orders'} for ${toSettle.userName} (${formatCurrency(toSettle.totalPending)}) as payment received?`
            : ''
        }
        isConfirming={settle.isPending}
        confirmLabel="All payment received"
        confirmPendingLabel="Settling…"
        confirmTone="success"
        onClose={() => setToSettle(null)}
        onConfirm={() => {
          if (!toSettle) return;
          settle.mutate(toSettle.userId, {
            onSuccess: (res) => {
              toast.success(`Settled ${res.settled} order${res.settled === 1 ? '' : 's'}.`);
              setToSettle(null);
            },
            onError: (e: Error) => toast.error(e.message || 'Failed to settle payments.'),
          });
        }}
      />
    </div>
  );
}
