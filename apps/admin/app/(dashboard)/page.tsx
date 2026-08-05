'use client';

import { DeleteIcon, IconButton } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { compactCurrency, Panel, StatCard } from '@/components/dashboard-ui';
import {
  OrderStatusActions,
  type OrderStatusAction,
} from '@/components/order-status-actions';
import { useAuth } from '@/lib/auth';
import { useDashboard, useDeleteOrder, useUpdateOrderStatus } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { type AdminOrderRow, type OrderStatus } from '@prime-kicks/types';
import { Badge } from '@prime-kicks/ui';
import { formatCurrency } from '@prime-kicks/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  APPROVED_PAYMENT_RECEIVED: 'success',
  APPROVED_PAYMENT_PENDING: 'neutral',
  REJECTED: 'danger',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_COLORS[status] ?? 'neutral'}>{status}</Badge>;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  // The dashboard is an ADMIN surface. Resellers land on the catalog instead.
  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/products');
  }, [user, router]);

  const { data, isLoading, isError } = useDashboard();
  const updateStatus = useUpdateOrderStatus();
  const deleteOrder = useDeleteOrder();
  const toast = useToast();

  const [statusChange, setStatusChange] = useState<{
    order: AdminOrderRow;
    action: OrderStatusAction;
  } | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<AdminOrderRow | null>(null);

  if (user && user.role !== 'ADMIN') return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-neutral-500">
          {data ? `Today · ${new Date(`${data.today.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}` : 'Business at a glance.'}
        </p>
      </div>

      {isError && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Failed to load dashboard. This section is restricted to ADMIN accounts and needs the API
          running.
        </p>
      )}
      {isLoading && !data && <p className="text-neutral-500">Loading…</p>}

      {data && (
        <div className="flex flex-col gap-6">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Today's orders"
              value={data.today.count}
              sub={`${formatCurrency(data.today.totalValue)} value`}
            />
            <StatCard
              label="Today's profit"
              value={compactCurrency(data.today.profit)}
              sub="Sold price − inhouse cost"
              tone="success"
            />
            <StatCard
              label="Pending payment"
              value={compactCurrency(data.pendingPayment.outstanding)}
              sub={`${data.pendingPayment.orders} orders · ${data.pendingPayment.customers} customers`}
              tone="warning"
              href="/payments"
            />
            <StatCard
              label="All-time revenue"
              value={compactCurrency(data.totals.revenue)}
              sub={`${data.totals.orders} orders · ${compactCurrency(data.totals.profit)} profit`}
            />
          </div>

          {/* Today's orders — act without leaving the dashboard */}
          <Panel
            title="Today's orders"
            action={
              <button
                type="button"
                onClick={() => router.push('/orders')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                All orders →
              </button>
            }
          >
            {data.today.orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400">No orders yet today.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-neutral-200 text-left text-neutral-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Order</th>
                      <th className="py-2 pr-3 font-medium">Customer</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Items</th>
                      <th className="py-2 pr-3 font-medium">Total</th>
                      <th className="py-2 pr-3 font-medium">Time</th>
                      <th className="py-2 pl-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.today.orders.map((order) => (
                      <tr key={order.id} className="border-b border-neutral-100 last:border-0">
                        <td className="py-2 pr-3">
                          <button
                            type="button"
                            className="cursor-pointer text-blue-600 hover:underline"
                            onClick={() => router.push(`/orders/${order.id}`)}
                          >
                            {order.orderNumber}
                          </button>
                        </td>
                        <td className="py-2 pr-3">{order.userName}</td>
                        <td className="py-2 pr-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="py-2 pr-3">{order.itemsCount}</td>
                        <td className="py-2 pr-3">
                          {formatCurrency(order.total, order.currency)}
                        </td>
                        <td className="py-2 pr-3 text-neutral-500">{timeLabel(order.createdAt)}</td>
                        <td className="py-2 pl-3">
                          <div className="flex items-center justify-end gap-1">
                            <OrderStatusActions
                              current={order.status as OrderStatus}
                              disabled={updateStatus.isPending}
                              onSelect={(action) => setStatusChange({ order, action })}
                            />
                            <IconButton
                              label="Delete"
                              tone="danger"
                              onClick={() => setOrderToDelete(order)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Status change confirmation */}
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
          if (!statusChange) return;
          updateStatus.mutate(
            { id: statusChange.order.id, status: statusChange.action.status },
            {
              onSuccess: () => setStatusChange(null),
            },
          );
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={orderToDelete !== null}
        title="Delete order?"
        description={
          orderToDelete
            ? `"${orderToDelete.orderNumber}" will be permanently deleted. This cannot be undone.`
            : ''
        }
        error={deleteOrder.error instanceof Error ? deleteOrder.error.message : undefined}
        isConfirming={deleteOrder.isPending}
        confirmLabel="Delete"
        confirmPendingLabel="Deleting…"
        confirmTone="danger"
        onClose={() => {
          setOrderToDelete(null);
          deleteOrder.reset();
        }}
        onConfirm={() => {
          if (!orderToDelete) return;
          deleteOrder.mutate(orderToDelete.id, {
            onSuccess: () => {
              toast.success('Order deleted.');
              setOrderToDelete(null);
            },
          });
        }}
      />
    </div>
  );
}
