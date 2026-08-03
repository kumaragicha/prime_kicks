'use client';

import { DeleteIcon, IconButton } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CreateOrderForm } from '@/components/create-order-form';
import {
  OrderStatusActions,
  type OrderStatusAction,
} from '@/components/order-status-actions';
import { controlClass, Pagination } from '@/components/table-controls';
import { useDeleteOrder, useOrders, useUpdateOrderStatus } from '@/lib/hooks';
import { ORDER_STATUS, type AdminOrderRow, type OrderStatus } from '@prime-kicks/types';
import { Badge } from '@prime-kicks/ui';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
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
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<AdminOrderRow | null>(null);
  const [statusChange, setStatusChange] = useState<{
    order: AdminOrderRow;
    action: OrderStatusAction;
  } | null>(null);

  const { data, isLoading, isError, isFetching } = useOrders({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
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
        cell: (c) => `₹${c.getValue().toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
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
          className={`${controlClass} w-full sm:w-auto`}
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
      </div>

      {isLoading && <p className="text-neutral-500">Loading…</p>}
      {isError && (
        <p className="text-red-600">
          Failed to load. This section is restricted to ADMIN accounts.
        </p>
      )}

      {data && (
        <>
          <div
            className="overflow-x-auto rounded-lg border border-neutral-200 bg-white"
            style={{ opacity: isFetching ? 0.6 : 1 }}
          >
            <table className="min-w-[760px] w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3 font-medium text-neutral-600">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3"
                        onClick={
                          cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-neutral-500">
                      No orders match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            onPage={setPage}
          />
        </>
      )}

      {/* Create Order modal */}
      <CreateOrderForm open={showCreateOrder} onClose={() => setShowCreateOrder(false)} />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={orderToDelete !== null}
        title="Delete order?"
        description={
          orderToDelete
            ? `"${orderToDelete.orderNumber}" will be permanently deleted. This cannot be undone.`
            : ''
        }
        isConfirming={deleteOrder.isPending}
        confirmLabel="Delete"
        confirmPendingLabel="Deleting…"
        confirmTone="danger"
        onClose={() => setOrderToDelete(null)}
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
        isConfirming={updateStatus.isPending}
        confirmLabel="Confirm"
        confirmPendingLabel="Updating…"
        confirmTone={statusChange?.action.tone === 'default' ? 'neutral' : statusChange?.action.tone}
        onClose={() => setStatusChange(null)}
        onConfirm={() => {
          if (statusChange) {
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
