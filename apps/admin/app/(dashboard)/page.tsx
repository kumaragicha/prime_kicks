'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { compactCurrency, Panel, StatCard } from '@/components/dashboard-ui';
import { type OrderStatusAction } from '@/components/order-status-actions';
import { OrdersTable } from '@/components/orders-table';
import { useAuth } from '@/lib/auth';
import { useDashboard, useDeleteOrder, useUpdateOrderStatus } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { type AdminOrderRow } from '@prime-kicks/types';
import { formatCurrency } from '@prime-kicks/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
            <OrdersTable
              orders={data.today.orders}
              emptyMessage="No orders yet today."
              updatePending={updateStatus.isPending}
              onStatusAction={(order, action) => setStatusChange({ order, action })}
              onDelete={(order) => setOrderToDelete(order)}
            />
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
