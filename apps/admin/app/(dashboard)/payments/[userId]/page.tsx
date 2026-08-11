'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  OrderStatusActions,
  type OrderStatusAction,
} from '@/components/order-status-actions';
import { SettleButton } from '@/components/settle-button';
import {
  usePaymentPendingUser,
  useSettlePayment,
  useUpdateOrderStatus,
} from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { ORDER_STATUS } from '@prime-kicks/types';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

/** Reject is never offered here — the payments view is only about settling. */
const HIDE_ON_PAYMENTS = [ORDER_STATUS.REJECTED];

export default function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { data, isLoading, isError } = usePaymentPendingUser(userId);
  const settle = useSettlePayment();
  const updateStatus = useUpdateOrderStatus();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [statusChange, setStatusChange] = useState<{
    order: { id: string; orderNumber: string };
    action: OrderStatusAction;
  } | null>(null);

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
                <th className="px-4 py-3 text-right font-medium text-neutral-600">Action</th>
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
                  <td className="px-4 py-3">
                    {/* Stop propagation so acting never opens the order detail. */}
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <OrderStatusActions
                        current={ORDER_STATUS.APPROVED_PAYMENT_PENDING}
                        hideStatuses={HIDE_ON_PAYMENTS}
                        disabled={updateStatus.isPending}
                        stopPropagation
                        onSelect={(action) =>
                          setStatusChange({
                            order: { id: o.id, orderNumber: o.orderNumber },
                            action,
                          })
                        }
                      />
                    </div>
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

      <ConfirmDialog
        open={statusChange !== null}
        title="Change order status?"
        description={
          statusChange
            ? `"${statusChange.order.orderNumber}" — this will ${statusChange.action.effect}.`
            : ''
        }
        error={updateStatus.error instanceof Error ? updateStatus.error.message : undefined}
        isConfirming={updateStatus.isPending}
        confirmLabel="Confirm"
        confirmPendingLabel="Updating…"
        confirmTone={statusChange?.action.tone === 'default' ? 'neutral' : statusChange?.action.tone}
        onClose={() => {
          setStatusChange(null);
          updateStatus.reset();
        }}
        onConfirm={() => {
          if (statusChange) {
            updateStatus.mutate(
              { id: statusChange.order.id, status: statusChange.action.status },
              {
                onSuccess: () => {
                  setStatusChange(null);
                  toast.success('Order status updated.');
                },
              },
            );
          }
        }}
      />
    </div>
  );
}
