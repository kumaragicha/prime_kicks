'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  OrderStatusActions,
  type OrderStatusAction,
} from '@/components/order-status-actions';
import { useOrder, useUpdateOrderStatus } from '@/lib/hooks';
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatus } from '@prime-kicks/types';
import { Badge } from '@prime-kicks/ui';
import { formatCurrency } from '@prime-kicks/utils';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  APPROVED_PAYMENT_RECEIVED: 'success',
  APPROVED_PAYMENT_PENDING: 'neutral',
  REJECTED: 'danger',
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: order, isLoading, isError, refetch } = useOrder(params.id as string);
  const updateStatus = useUpdateOrderStatus();
  const [pendingAction, setPendingAction] = useState<OrderStatusAction | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-neutral-500">Loading order details…</div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-600">Order not found.</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-neutral-600 hover:text-neutral-900 underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-6"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        Back to orders
      </button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Order {order.orderNumber}</h1>
          <div className="flex gap-3">
            <Badge tone={STATUS_COLORS[order.status] ?? 'neutral'}>{order.status}</Badge>
            {order.status !== ORDER_STATUS.REJECTED && (
              <Badge tone={order.paymentStatus === PAYMENT_STATUS.RECEIVED ? 'success' : 'warning'}>
                Payment: {order.paymentStatus}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-1 items-center">
          <OrderStatusActions
            current={order.status as OrderStatus}
            disabled={updateStatus.isPending}
            onSelect={setPendingAction}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Main column: items + shipping */}
        <div className="grid gap-6 lg:col-span-2">
          {/* Order Items with Photos */}
          <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-200">
              <h2 className="text-sm font-semibold text-neutral-900">Order Items</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <div key={item.id} className="px-5 py-4 flex gap-4">
                  {item.product.photoUrls?.[0] && (
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.product.photoUrls[0]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">SKU: {item.sku}</p>
                      {item.sizeLabel && (
                        <p className="text-xs text-neutral-600 mt-1">Size: {item.sizeLabel}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-neutral-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatCurrency(item.unitPrice)} × {item.quantity}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="border border-neutral-200 rounded-lg p-5 bg-white">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Shipping Address</h2>
            <div className="text-sm text-neutral-700 space-y-1">
              <p className="font-medium text-neutral-900">{order.address.name}</p>
              <p>{order.address.line1}</p>
              {order.address.line2 && <p>{order.address.line2}</p>}
              {order.address.landmark && <p>{order.address.landmark}</p>}
              <p>
                {order.address.city}, {order.address.state} - {order.address.pincode}
              </p>
              <p className="pt-1">{order.address.mobileNo}</p>
              {order.address.altMobileNo && <p>Alt: {order.address.altMobileNo}</p>}
              {order.address.email && <p>{order.address.email}</p>}
            </div>
          </div>
        </div>

        {/* Sidebar: summary + customer/date, stays in view while scrolling items */}
        <aside className="grid gap-6 lg:sticky lg:top-6">
          {/* Pricing Summary */}
          <div className="border border-neutral-200 rounded-lg p-5 bg-white">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Shipping</span>
                <span className="font-medium">
                  {order.shipping === 0 ? 'Free' : formatCurrency(order.shipping)}
                </span>
              </div>
              <div className="flex justify-between pt-2 mt-1 border-t border-neutral-200 text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Customer & date */}
          <div className="border border-neutral-200 rounded-lg p-5 bg-white">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Customer</h2>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{order.userName}</p>
              <p className="text-neutral-600 break-all">User ID: {order.userId}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
                Order Date
              </h3>
              <p className="text-sm text-neutral-900">
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Undo Confirmation Dialog */}
      <ConfirmDialog
        open={pendingAction !== null}
        title="Change order status?"
        description={
          pendingAction ? `This will ${pendingAction.effect}.` : ''
        }
        error={updateStatus.error instanceof Error ? updateStatus.error.message : undefined}
        isConfirming={updateStatus.isPending}
        confirmLabel="Confirm"
        confirmPendingLabel="Updating…"
        confirmTone={pendingAction?.tone === 'default' ? 'neutral' : pendingAction?.tone}
        onClose={() => {
          setPendingAction(null);
          updateStatus.reset();
        }}
        onConfirm={() => {
          if (pendingAction) {
            updateStatus.mutate(
              { id: order.id, status: pendingAction.status },
              {
                onSuccess: () => {
                  refetch();
                  setPendingAction(null);
                },
              },
            );
          }
        }}
      />
    </div>
  );
}
