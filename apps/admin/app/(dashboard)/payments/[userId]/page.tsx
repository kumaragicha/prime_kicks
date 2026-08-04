'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { SettleButton } from '@/components/settle-button';
import { usePaymentPendingUser, useSettlePayment } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { data, isLoading, isError } = usePaymentPendingUser(userId);
  const settle = useSettlePayment();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  if (isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (isError || !data) return <p className="text-red-600">Failed to load customer payments.</p>;

  const orderCount = data.orders.length;

  return (
    <div>
      <Link
        href="/payments"
        className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
      >
        ← Back to payment pending
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.userName}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {orderCount} pending {orderCount === 1 ? 'order' : 'orders'} ·{' '}
            <span className="font-semibold text-neutral-900">
              {formatCurrency(data.totalPending)}
            </span>{' '}
            outstanding
          </p>
        </div>
        {orderCount > 0 && (
          <SettleButton
            className="w-full sm:w-auto"
            disabled={settle.isPending}
            onClick={() => setConfirm(true)}
          />
        )}
      </div>

      {orderCount === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          No pending payments for this customer.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-neutral-600">Order</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Items</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Date</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr
                  key={o.id}
                  className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                  onClick={() => router.push(`/orders/${o.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-neutral-900">{o.orderNumber}</td>
                  <td className="px-4 py-3">{o.itemsCount}</td>
                  <td className="px-4 py-3">
                    {new Date(o.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(o.total, o.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Mark all as received?"
        description={`Mark all ${orderCount} pending ${orderCount === 1 ? 'order' : 'orders'} for ${data.userName} (${formatCurrency(data.totalPending)}) as payment received?`}
        isConfirming={settle.isPending}
        confirmLabel="All payment received"
        confirmPendingLabel="Settling…"
        confirmTone="success"
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          settle.mutate(userId, {
            onSuccess: (res) => {
              toast.success(`Settled ${res.settled} order${res.settled === 1 ? '' : 's'}.`);
              setConfirm(false);
              router.push('/payments');
            },
            onError: (e: Error) => toast.error(e.message || 'Failed to settle payments.'),
          });
        }}
      />
    </div>
  );
}
