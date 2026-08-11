'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { CreateOrderForm } from '@/components/create-order-form';
import { DateRangePicker } from '@/components/date-range-picker';
import { type OrderStatusAction } from '@/components/order-status-actions';
import { OrdersTable } from '@/components/orders-table';
import { controlClass, Pagination, selectClass } from '@/components/table-controls';
import { useDebouncedValue, useDeleteOrder, useOrders, useUpdateOrderStatus } from '@/lib/hooks';
import { ORDER_STATUS, type AdminOrderRow } from '@prime-kicks/types';
import { useState } from 'react';

const PAGE_SIZE = 10;

export default function OrdersPage() {
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
          <OrdersTable
            orders={data.data}
            isFetching={isFetching}
            emptyMessage="No orders match your filters."
            indexOffset={(page - 1) * PAGE_SIZE}
            updatePending={updateStatus.isPending}
            onStatusAction={(order, action) => setStatusChange({ order, action })}
            onDelete={(order) => setOrderToDelete(order)}
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
