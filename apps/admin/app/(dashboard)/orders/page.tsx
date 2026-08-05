'use client';

import { DeleteIcon, IconButton } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CreateOrderForm } from '@/components/create-order-form';
import { DateRangePicker } from '@/components/date-range-picker';
import {
  OrderStatusActions,
  type OrderStatusAction,
} from '@/components/order-status-actions';
import { controlClass, DataTable, Pagination, selectClass } from '@/components/table-controls';
import { useDebouncedValue, useDeleteOrder, useOrders, useUpdateOrderStatus } from '@/lib/hooks';
import { ORDER_STATUS, type AdminOrderRow, type OrderStatus } from '@prime-kicks/types';
import { Badge } from '@prime-kicks/ui';
import { formatCurrency } from '@prime-kicks/utils';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const columnHelper = createColumnHelper<AdminOrderRow>();
const PAGE_SIZE = 10;

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  APPROVED_PAYMENT_RECEIVED: 'success',
  APPROVED_PAYMENT_PENDING: 'neutral',
  REJECTED: 'danger',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_COLORS[status] ?? 'neutral'}>{status}</Badge>;
}

export default function OrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<AdminOrderRow | null>(null);
  const [statusChange, setStatusChange] = useState<{
    order: AdminOrderRow;
    action: OrderStatusAction;
  } | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const { data, isLoading, isError, isFetching } = useOrders({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const updateStatus = useUpdateOrderStatus();
  const deleteOrder = useDeleteOrder();

  const resetTo =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const columns = useMemo(
    () => [
      columnHelper.accessor('orderNumber', {
        header: 'Order',
        cell: (c) => {
          const id = c.row.original.id;
          const orderNumber = c.getValue();
          return (
            <button
              type="button"
              className="text-blue-600 hover:underline cursor-pointer"
              onClick={() => router.push(`/orders/${id}`)}
            >
              {orderNumber}
            </button>
          );
        },
      }),
      columnHelper.accessor('userName', { header: 'Customer' }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (c) => <StatusBadge status={c.getValue()} />,
      }),
      columnHelper.accessor('itemsCount', { header: 'Items' }),
      columnHelper.accessor('total', {
        header: 'Total',
        cell: (c) => formatCurrency(c.getValue(), c.row.original.currency),
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
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Action</div>,
        cell: (c) => {
          const order = c.row.original;
          return (
            <div
              className="flex justify-end gap-1 items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <OrderStatusActions
                current={order.status as OrderStatus}
                stopPropagation
                onSelect={(action) => setStatusChange({ order, action })}
              />
              <IconButton
                label="Delete"
                tone="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setOrderToDelete(order);
                }}
              >
                <DeleteIcon />
              </IconButton>
            </div>
          );
        },
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <button
          type="button"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          onClick={() => setShowCreateOrder(true)}
        >
          Create Order
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          className={`${controlClass} w-full sm:min-w-56 sm:flex-1`}
          placeholder="Search order number, customer…"
          value={search}
          onChange={(e) => resetTo(setSearch)(e.target.value)}
        />
        <select
          className={`${selectClass} w-full sm:w-auto`}
          value={status}
          onChange={(e) => resetTo(setStatus)(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value={ORDER_STATUS.PENDING}>Pending</option>
          <option value={ORDER_STATUS.APPROVED_PAYMENT_RECEIVED}>
            Approved (Payment Received)
          </option>
          <option value={ORDER_STATUS.APPROVED_PAYMENT_PENDING}>Approved (Payment Pending)</option>
          <option value={ORDER_STATUS.REJECTED}>Rejected</option>
        </select>

        <DateRangePicker
          start={startDate}
          end={endDate}
          onChange={({ start, end }) => {
            setStartDate(start);
            setEndDate(end);
            setPage(1);
          }}
        />
      </div>

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
            emptyMessage="No orders match your filters."
          />

          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            onPage={setPage}
          />
        </>
      )}

      {/* Create Order modal — only mounted while open, so its reseller/product
          queries don't run in the background behind the orders list. */}
      {showCreateOrder && (
        <CreateOrderForm open onClose={() => setShowCreateOrder(false)} />
      )}

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
          if (orderToDelete) {
            deleteOrder.mutate(orderToDelete.id, { onSuccess: () => setOrderToDelete(null) });
          }
        }}
      />

      {/* Status change confirmation — one dialog for every transition */}
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
            // On error the dialog stays open and shows the API message
            // (e.g. insufficient stock when un-rejecting an order).
            updateStatus.mutate(
              { id: statusChange.order.id, status: statusChange.action.status },
              { onSuccess: () => setStatusChange(null) },
            );
          }
        }}
      />
    </div>
  );
}
