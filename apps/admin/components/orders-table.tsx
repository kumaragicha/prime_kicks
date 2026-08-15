'use client';

import { DeleteIcon, IconButton } from '@/components/action-controls';
import { OrderStatusActions, type OrderStatusAction } from '@/components/order-status-actions';
import { DataTable } from '@/components/table-controls';
import { type AdminOrderRow, type OrderStatus, type ShipmentStatus } from '@prime-kicks/types';
import { Badge } from '@prime-kicks/ui';
import { formatCurrency } from '@prime-kicks/utils';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

const columnHelper = createColumnHelper<AdminOrderRow>();

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  APPROVED_PAYMENT_RECEIVED: 'success',
  APPROVED_PAYMENT_PENDING: 'neutral',
  REJECTED: 'danger',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_COLORS[status] ?? 'neutral'}>{status}</Badge>;
}

const SHIPMENT_STATUS_COLORS: Record<
  ShipmentStatus,
  'neutral' | 'success' | 'warning' | 'danger' | 'blue'
> = {
  NOT_SHIPPED: 'neutral',
  PUSHED: 'blue',
  ASSIGNED: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
};

/** Human labels for the Shipmozo shipment lifecycle. */
const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  NOT_SHIPPED: 'Not shipped',
  PUSHED: 'Pushed',
  ASSIGNED: 'Assigned',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <Badge tone={SHIPMENT_STATUS_COLORS[status] ?? 'neutral'}>
      {SHIPMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/**
 * The one orders table shared by the Orders page and the Dashboard's "today's
 * orders" panel, so a column change lands in both at once. Clicking a row opens
 * the order detail; the action controls stop propagation so they never trigger
 * that navigation. The parent owns the confirm dialogs + mutations and reacts
 * via {@link onStatusAction} / {@link onDelete}.
 */
export function OrdersTable({
  orders,
  isFetching = false,
  emptyMessage = 'No orders.',
  indexOffset = 0,
  updatePending = false,
  onStatusAction,
  onDelete,
}: {
  orders: AdminOrderRow[];
  isFetching?: boolean;
  emptyMessage?: string;
  /** Added to the row index for the serial "#" column (page offset). */
  indexOffset?: number;
  updatePending?: boolean;
  onStatusAction: (order: AdminOrderRow, action: OrderStatusAction) => void;
  onDelete: (order: AdminOrderRow) => void;
}) {
  const router = useRouter();

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'index',
        header: '#',
        cell: (c) => <span>{indexOffset + c.row.index + 1}</span>,
      }),
      columnHelper.accessor('userName', {
        header: 'Customer',
        cell: (c) => {
          const role = c.row.original.userRole;
          const label = role ? role.charAt(0) + role.slice(1).toLowerCase() : null;
          // The delivery recipient is often not the person who placed the
          // order, so surface the shipping contact name whenever it differs.
          const deliveryName = c.row.original.deliveryName;
          const showDelivery = deliveryName && deliveryName !== c.getValue();
          return (
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span>{c.getValue()}</span>
                {c.row.original.isPickup && <Badge tone="blue">Pickup</Badge>}
              </div>
              {label && (
                <span
                  className={`mt-0.5 text-xs ${role === 'RESELLER' ? 'text-purple-600' : 'text-neutral-500'}`}
                >
                  {label}
                </span>
              )}
              {showDelivery && (
                <span className="mt-0.5 text-xs text-neutral-500">Deliver to: {deliveryName}</span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (c) => <StatusBadge status={c.getValue()} />,
      }),
      columnHelper.accessor('shipmentStatus', {
        header: 'Courier',
        cell: (c) => <ShipmentStatusBadge status={c.getValue()} />,
      }),
      columnHelper.accessor('trackingId', {
        header: 'Tracking',
        cell: (c) => {
          const tracking = c.getValue();
          if (!tracking) return <span className="text-neutral-400">—</span>;
          const courier = c.row.original.courierPartner;
          return (
            <div className="leading-tight">
              <span className="font-medium">{tracking}</span>
              {courier && <span className="block text-xs text-neutral-500">{courier}</span>}
            </div>
          );
        },
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
            // Stop propagation so acting on an order never opens its detail page.
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <OrderStatusActions
                current={order.status as OrderStatus}
                shipmentStatus={order.shipmentStatus}
                disabled={updatePending}
                stopPropagation
                onSelect={(action) => onStatusAction(order, action)}
              />
              <IconButton
                label="Delete"
                tone="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(order);
                }}
              >
                <DeleteIcon />
              </IconButton>
            </div>
          );
        },
      }),
    ],
    [indexOffset, updatePending, onStatusAction, onDelete],
  );

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DataTable
      table={table}
      isFetching={isFetching}
      emptyMessage={emptyMessage}
      onRowClick={(order) => router.push(`/orders/${order.id}`)}
    />
  );
}
