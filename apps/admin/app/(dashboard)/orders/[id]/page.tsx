'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useApproveOrder, useOrder, useRejectOrder } from '@/lib/hooks';
import { ORDER_STATUS, PAYMENT_STATUS } from '@prime-kicks/types';
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
  const approveOrder = useApproveOrder();
  const rejectOrder = useRejectOrder();
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [actionType, setActionType] = useState<
    'approve-received' | 'approve-pending' | 'reject' | null
  >(null);

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

  const canApprove = order.status === ORDER_STATUS.PENDING;

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

        {canApprove && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActionType('approve-received');
                approveOrder.mutate(
                  { id: order.id, paymentStatus: PAYMENT_STATUS.RECEIVED },
                  { onSuccess: () => refetch() },
                );
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
              title="Approve & Payment Received"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="hidden sm:inline">Approve</span>
              <span className="text-[10px]">₹</span>
            </button>
            <button
              onClick={() => {
                setActionType('approve-pending');
                approveOrder.mutate(
                  { id: order.id, paymentStatus: PAYMENT_STATUS.PENDING },
                  { onSuccess: () => refetch() },
                );
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700"
              title="Approve & Payment Pending"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="hidden sm:inline">Approve</span>
              <span className="text-[10px]">₹?</span>
            </button>
            <button
              onClick={() => {
                setActionType('reject');
                rejectOrder.mutate(order.id, { onSuccess: () => refetch() });
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700"
              title="Reject"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="hidden sm:inline">Reject</span>
            </button>
          </div>
        )}

        {!canApprove && (
          <button
            onClick={() => setShowUndoConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-600 text-white text-xs font-medium rounded-lg hover:bg-neutral-700"
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
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
              />
            </svg>
            Undo
          </button>
        )}
      </div>

      <div className="grid gap-6">
        {/* Customer & Order Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-neutral-200 rounded-lg p-5 bg-white">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Customer</h2>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{order.userName}</p>
              <p className="text-neutral-600">User ID: {order.userId}</p>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-lg p-5 bg-white">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Order Date</h2>
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
            <p>{order.address.email}</p>
          </div>
        </div>

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
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">SKU: {item.sku}</p>
                  {item.sizeLabel && (
                    <p className="text-xs text-neutral-600 mt-1">Size: {item.sizeLabel}</p>
                  )}
                  <div className="text-right mt-2">
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
            <div className="flex justify-between pt-2 border-t border-neutral-200 text-base">
              <span className="font-semibold">Total</span>
              <span className="font-bold">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Undo Confirmation Dialog */}
      <ConfirmDialog
        open={showUndoConfirm}
        title="Undo order action?"
        description={
          actionType === 'approve-received'
            ? 'This will reset the order to PENDING status and payment to PENDING. Inventory will be restored.'
            : actionType === 'approve-pending'
              ? 'This will reset the order to PENDING status. Inventory will be restored.'
              : 'This will reset the order to PENDING status. Inventory will be restored.'
        }
        isConfirming={approveOrder.isPending || rejectOrder.isPending}
        onClose={() => {
          setShowUndoConfirm(false);
          setActionType(null);
        }}
        onConfirm={() => {
          // TODO: Implement undo API endpoint
          // For now, just close the dialog
          setShowUndoConfirm(false);
          setActionType(null);
        }}
      />
    </div>
  );
}
