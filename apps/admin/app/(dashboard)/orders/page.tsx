'use client';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { CreateOrderForm } from '@/components/create-order-form';
import { controlClass, Pagination } from '@/components/table-controls';
import {
  useApproveOrder,
  useDeleteOrder,
  useOrders,
  useRejectOrder,
  useUpdateOrderStatus,
} from '@/lib/hooks';
import { ORDER_STATUS, PAYMENT_STATUS, type AdminOrderRow } from '@prime-kicks/types';
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
  const [orderToUpdateStatus, setOrderToUpdateStatus] = useState<AdminOrderRow | null>(null);
  const [statusAction, setStatusAction] = useState('');
  const [orderToApproveReceived, setOrderToApproveReceived] = useState<AdminOrderRow | null>(null);
  const [orderToApprovePending, setOrderToApprovePending] = useState<AdminOrderRow | null>(null);
  const [orderToReject, setOrderToReject] = useState<AdminOrderRow | null>(null);

  const { data, isLoading, isError, isFetching } = useOrders({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
  });

  const updateStatus = useUpdateOrderStatus();
  const deleteOrder = useDeleteOrder();
  const approveOrder = useApproveOrder();
  const rejectOrder = useRejectOrder();

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
        cell: (c) => <span className="text-blue-600">{c.getValue()}</span>,
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
        header: '',
        cell: (c) => {
          const order = c.row.original;
          return (
            <div className="flex justify-end gap-1 items-center">
              {order.status === ORDER_STATUS.PENDING && (
                <>
                  <button
                    type="button"
                    className="text-green-600 hover:text-green-800 p-1"
                    onClick={() => setOrderToApproveReceived(order)}
                    title="Approve & Payment Received"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      <text
                        x="12"
                        y="16"
                        textAnchor="middle"
                        fontSize="7"
                        fill="currentColor"
                        stroke="none"
                        fontWeight="bold"
                      >
                        ₹
                      </text>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="text-orange-600 hover:text-orange-800 p-1"
                    onClick={() => setOrderToApprovePending(order)}
                    title="Approve & Payment Pending"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      <text
                        x="12"
                        y="16"
                        textAnchor="middle"
                        fontSize="7"
                        fill="currentColor"
                        stroke="none"
                        fontWeight="bold"
                      >
                        ₹
                      </text>
                      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeWidth="1.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-800 p-1"
                    onClick={() => setOrderToReject(order)}
                    title="Reject"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
              <button
                type="button"
                className="text-red-600 hover:text-red-800 p-1"
                onClick={() => setOrderToDelete(order)}
                title="Delete"
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
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.061-.94-1.75-1.816-1.618l-1.588.32a1.875 1.875 0 01-1.7-1.7l.32-1.588c.132-.876.56-1.476 1.618-1.816l.916-.916c1.125-.84 1.8-2.1 1.8-3.423 0-1.323-.675-2.583-1.8-3.423l-.916-.916c-.876-.132-1.476-.56-1.816-1.618l-.32-1.588a1.875 1.875 0 00-1.7-1.7l-1.588.32c-.876.132-1.476.56-1.618 1.616l-.916.916c-.84 1.125-2.1 1.8-3.423 1.8s-2.583-.675-3.423-1.8l-.916-.916c-.132-.876-.56-1.476-1.616-1.618l-1.588-.32a1.875 1.875 0 00-1.7 1.7l.32 1.588c.132.876.56 1.476 1.616 1.618l.916.916c1.125.84 1.8 2.1 1.8 3.423 0 1.323.675 2.583 1.8 3.423l.916.916c.876.132 1.476.56 1.616 1.616l.32 1.588a1.875 1.875 0 001.7 1.7l1.588-.32c.876-.132 1.476-.56 1.616-1.616l.916-.916c.84-1.125 2.1-1.8 3.423-1.8s2.583.675 3.423 1.8l.916.916c.132.876.56 1.476 1.616 1.616l.32 1.588a1.875 1.875 0 001.7 1.7l-1.588.32c-.876.132-1.476.56-1.616 1.616l-.916.916z"
                  />
                </svg>
              </button>
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
                  <tr
                    key={row.id}
                    className="border-b border-neutral-100 last:border-0 cursor-pointer hover:bg-neutral-50"
                    onClick={() => router.push(`/orders/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
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
        onClose={() => setOrderToDelete(null)}
        onConfirm={() => {
          if (orderToDelete) {
            deleteOrder.mutate(orderToDelete.id, { onSuccess: () => setOrderToDelete(null) });
          }
        }}
      />

      {/* Approve & Payment Received confirmation */}
      <ConfirmDialog
        open={orderToApproveReceived !== null}
        title="Approve order?"
        description={
          orderToApproveReceived
            ? `Approve "${orderToApproveReceived.orderNumber}"? Payment: RECEIVED. Inventory will be reduced.`
            : ''
        }
        isConfirming={approveOrder.isPending}
        onClose={() => setOrderToApproveReceived(null)}
        onConfirm={() => {
          if (orderToApproveReceived) {
            approveOrder.mutate(
              { id: orderToApproveReceived.id, paymentStatus: PAYMENT_STATUS.RECEIVED },
              { onSuccess: () => setOrderToApproveReceived(null) },
            );
          }
        }}
      />

      {/* Approve & Payment Pending confirmation */}
      <ConfirmDialog
        open={orderToApprovePending !== null}
        title="Approve order?"
        description={
          orderToApprovePending
            ? `Approve "${orderToApprovePending.orderNumber}"? Payment: PENDING. Inventory will be reduced.`
            : ''
        }
        isConfirming={approveOrder.isPending}
        onClose={() => setOrderToApprovePending(null)}
        onConfirm={() => {
          if (orderToApprovePending) {
            approveOrder.mutate(
              { id: orderToApprovePending.id, paymentStatus: PAYMENT_STATUS.PENDING },
              { onSuccess: () => setOrderToApprovePending(null) },
            );
          }
        }}
      />

      {/* Reject confirmation */}
      <ConfirmDialog
        open={orderToReject !== null}
        title="Reject order?"
        description={
          orderToReject
            ? `Reject "${orderToReject.orderNumber}"? Stock will be restored to inventory.`
            : ''
        }
        isConfirming={rejectOrder.isPending}
        onClose={() => setOrderToReject(null)}
        onConfirm={() => {
          if (orderToReject) {
            rejectOrder.mutate(orderToReject.id, { onSuccess: () => setOrderToReject(null) });
          }
        }}
      />
    </div>
  );
}
