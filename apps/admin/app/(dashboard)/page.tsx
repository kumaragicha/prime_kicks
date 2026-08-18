'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { compactCurrency, Panel, StatCard } from '@/components/dashboard-ui';
import { DateRangePicker } from '@/components/date-range-picker';
import { type OrderStatusAction } from '@/components/order-status-actions';
import { OrdersTable } from '@/components/orders-table';
import { type DashboardData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDashboard, useDeleteOrder, useUpdateOrderStatus } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { type AdminOrderRow } from '@prime-kicks/types';
import { formatCurrency } from '@prime-kicks/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Local YYYY-MM-DD for "today" — matches the picker's calendar keys. */
function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDate(key: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', opts);
}

/** Human subtitle describing the active window. */
function rangeLabel(
  data: DashboardData | undefined,
  start: string,
  end: string,
): string {
  const from = data?.range.from ?? start;
  const to = data?.range.to ?? end;
  if (!from || !to) return 'Business at a glance.';
  if (from === to) {
    const prefix = from === todayKey() ? 'Today · ' : '';
    return `${prefix}${fmtDate(from, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`;
  }
  const days =
    Math.round(
      (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000,
    ) + 1;
  const short: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  return `${fmtDate(from, short)} – ${fmtDate(to, short)} · ${days} days`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  // The dashboard is an ADMIN surface. Resellers land on the catalog instead.
  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/products');
  }, [user, router]);

  // Raw picker state, defaulting to today. Kept as the picker emits it (end is
  // empty mid-selection) so its two-click flow works; the effective range below
  // fills any gap with today.
  const [startDate, setStartDate] = useState(todayKey);
  const [endDate, setEndDate] = useState(todayKey);

  // What every metric actually queries. Empty bounds fall back to today so the
  // dashboard is never blank, and a half-picked range shows that single day.
  const effFrom = startDate || todayKey();
  const effTo = endDate || startDate || todayKey();

  const { data, isLoading, isError } = useDashboard({ from: effFrom, to: effTo });
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-neutral-500">{rangeLabel(data, startDate, endDate)}</p>
        </div>
        <DateRangePicker
          start={startDate}
          end={endDate}
          onChange={({ start, end }) => {
            // Pass through exactly as the picker emits (end is '' mid-selection)
            // so its start→end two-click flow completes. The effective range
            // above fills any empty bound with today.
            setStartDate(start);
            setEndDate(end);
          }}
        />
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
          {/* KPI tiles — all scoped to the selected range */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label={data.range.isToday ? "Today's orders" : 'Orders'}
              value={data.summary.count}
              sub={`${formatCurrency(data.summary.totalValue)} value`}
            />
            <StatCard
              label="Revenue"
              value={compactCurrency(data.summary.totalValue)}
              sub={`${data.summary.count} orders`}
            />
            <StatCard
              label="Profit"
              value={compactCurrency(data.summary.profit)}
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
          </div>

          {/* Orders in range — act without leaving the dashboard */}
          <Panel
            title={data.range.isToday ? "Today's orders" : 'Orders'}
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
            {data.summary.truncated && (
              <p className="mb-3 text-xs text-neutral-500">
                Showing the latest {data.summary.orders.length} of {data.summary.count} orders. Use
                the <span className="font-medium">All orders</span> page to see them all.
              </p>
            )}
            <OrdersTable
              orders={data.summary.orders}
              emptyMessage={data.range.isToday ? 'No orders yet today.' : 'No orders in this range.'}
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
