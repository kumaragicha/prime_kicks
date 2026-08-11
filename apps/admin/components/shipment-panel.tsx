'use client';

import {
  useAssignCourier,
  useAttachShipmozoOrder,
  useDropShipment,
  useMarkManualShipment,
  useShipmozoSettings,
} from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { SHIPMENT_STATUS, type OrderShipment } from '@prime-kicks/types';
import { Badge, Button } from '@prime-kicks/ui';
import { useState } from 'react';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'blue'> = {
  NOT_SHIPPED: 'neutral',
  PUSHED: 'blue',
  ASSIGNED: 'success',
  FAILED: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  NOT_SHIPPED: 'Not shipped',
  PUSHED: 'Pushed to Shipmozo',
  ASSIGNED: 'Shipped',
  FAILED: 'Shipment failed',
};

/** Courier the store ships with by default — pre-filled into the AWB form. */
const DEFAULT_COURIER = 'Tirupati';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-600">{label}</span>
      <span className="font-medium text-neutral-900 text-right break-all">{value}</span>
    </div>
  );
}

export function ShipmentPanel({
  orderId,
  shipment,
  state,
}: {
  orderId: string;
  shipment: OrderShipment;
  /** The order's shipping-address state — decides if it's a manual (skip-state) order. */
  state: string;
}) {
  const markShipped = useMarkManualShipment(orderId);
  const attachShipmozo = useAttachShipmozoOrder(orderId);
  const dropShipment = useDropShipment(orderId);
  const assignCourier = useAssignCourier(orderId);
  const settings = useShipmozoSettings();
  const toast = useToast();

  const status = shipment.status ?? SHIPMENT_STATUS.NOT_SHIPPED;
  const hasTracking = Boolean(shipment.trackingId);

  // This order is handled manually (not pushed to Shipmozo) when the whole
  // integration is off, or when its state is in the admin's skip list. Matching
  // is case/whitespace-insensitive, mirroring the API's skip logic.
  const normalizedState = state.trim().toLowerCase();
  const isSkipState = (settings.data?.skipStates ?? []).some(
    (s) => s.trim().toLowerCase() === normalizedState,
  );
  const isManualOrder = settings.data ? !settings.data.enabled || isSkipState : false;

  // Anything past NOT_SHIPPED (pushed, assigned, failed) or with an AWB has a
  // shipment on record that can be dropped.
  const hasShipment = status !== SHIPMENT_STATUS.NOT_SHIPPED || hasTracking;
  // Offer the manual courier + AWB entry only for a manual (skip-state /
  // integration-off) order that has no shipment yet.
  const showManualForm = isManualOrder && !hasShipment;
  // Drop is available for ANY shipped order — manual or Shipmozo — so admins can
  // keep our records in sync after deleting an order in the Shipmozo panel.
  const showDropButton = hasShipment;
  // Connecting an existing Shipmozo order id is offered for ANY order that isn't
  // currently on a shipment — including a normal (Shipmozo-enabled) order that
  // was pushed, then dropped, then re-created by hand in the Shipmozo panel.
  const showConnectForm = !hasShipment;
  // Retry courier assignment: the order is already in the Shipmozo panel but has
  // no courier yet (e.g. every configured courier failed to assign at push time).
  // This re-attempts assignment WITHOUT re-pushing, so it can't create a duplicate.
  const canRetryAssign = Boolean(shipment.shipmozoOrderId) && status !== SHIPMENT_STATUS.ASSIGNED;

  const [courier, setCourier] = useState(shipment.courierPartner || DEFAULT_COURIER);
  const [awb, setAwb] = useState(shipment.trackingId || '');
  const [shipmozoOrderId, setShipmozoOrderId] = useState('');

  const onAttach = () => {
    const id = shipmozoOrderId.trim();
    if (!id) return toast.error('Enter the Shipmozo order id to attach.');
    attachShipmozo.mutate(
      { shipmozoOrderId: id },
      {
        onSuccess: () => {
          setShipmozoOrderId('');
          toast.success('Shipmozo order attached — order marked as shipped.');
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not find that Shipmozo order id.'),
      },
    );
  };

  const onAssign = () =>
    assignCourier.mutate(undefined, {
      onSuccess: (res) => {
        if (res.shipmentStatus === SHIPMENT_STATUS.ASSIGNED) {
          toast.success(
            res.courierPartner
              ? `Courier assigned: ${res.courierPartner}${res.trackingId ? ` (AWB ${res.trackingId})` : ''}.`
              : 'Courier assigned.',
          );
        } else {
          // Stayed PUSHED — every configured courier failed; the reason is shown
          // in the shipment-error box above.
          toast.error(res.shipmentError || 'No courier could be assigned. See the error above.');
        }
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not assign a courier.'),
    });

  const onDrop = () =>
    dropShipment.mutate(undefined, {
      onSuccess: () => {
        setCourier(DEFAULT_COURIER);
        setAwb('');
        toast.success('Shipment dropped — order reverted to not shipped.');
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not drop the shipment.'),
    });

  const onSubmit = () => {
    const courierPartner = courier.trim();
    const trackingId = awb.trim();
    if (!courierPartner) return toast.error('Courier name is required.');
    if (!trackingId) return toast.error('AWB / tracking number is required.');
    markShipped.mutate(
      { courierPartner, trackingId },
      {
        onSuccess: () => toast.success('Order marked as shipped.'),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not mark as shipped.'),
      },
    );
  };

  return (
    <div className="border border-neutral-200 rounded-lg p-5 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neutral-900">Shipment</h2>
        <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{STATUS_LABEL[status] ?? status}</Badge>
      </div>

      <div className="space-y-2 text-sm">
        {shipment.trackingId && <Row label="AWB / Tracking" value={shipment.trackingId} />}
        {shipment.courierPartner && <Row label="Courier" value={shipment.courierPartner} />}
        {shipment.pushedAt && (
          <Row
            label="Shipped at"
            value={new Date(shipment.pushedAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          />
        )}
        {!hasShipment && !showManualForm && <p className="text-neutral-500">Not yet shipped.</p>}
      </div>

      {shipment.error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Shipmozo shipment error</p>
          <p className="mt-1 break-words">{shipment.error}</p>
        </div>
      )}

      {/* Manual shipping: only for skip-state / integration-off orders that aren't
          tracked yet. Enter the local courier + AWB and mark the order shipped. */}
      {showManualForm && (
        <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Courier company
            </label>
            <input
              className={fieldClass}
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="e.g. Tirupati"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              AWB / Tracking number
            </label>
            <input
              className={fieldClass}
              value={awb}
              onChange={(e) => setAwb(e.target.value)}
              placeholder="Enter tracking number"
            />
          </div>
          <Button size="sm" onClick={onSubmit} disabled={markShipped.isPending}>
            {markShipped.isPending ? 'Saving…' : 'Mark as shipped'}
          </Button>
        </div>
      )}

      {/* Connect an existing Shipmozo order: available for any order not
          currently on a shipment. Use it after dropping an auto-pushed order and
          re-creating it by hand in the Shipmozo panel — enter its Shipmozo order
          id and we call get-order-detail, verify it matches this order (pincode +
          mobile), and mark it shipped with the courier + AWB Shipmozo returns. */}
      {showConnectForm && (
        <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
          <label className="block text-xs font-medium text-neutral-600">
            Connect a Shipmozo order id
          </label>
          <div className="flex items-center gap-2">
            <input
              className={fieldClass}
              value={shipmozoOrderId}
              onChange={(e) => setShipmozoOrderId(e.target.value)}
              placeholder="e.g. 12345678"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={onAttach}
              disabled={attachShipmozo.isPending}
            >
              {attachShipmozo.isPending ? 'Connecting…' : 'Connect'}
            </Button>
          </div>
          <p className="text-xs text-neutral-400">
            We fetch the order from Shipmozo and verify it matches this order before connecting.
          </p>
        </div>
      )}

      {/* Retry courier assignment on an already-pushed order. Reuses the existing
          Shipmozo order (no re-push, no duplicate) and walks the configured
          couriers in priority order until one books. */}
      {canRetryAssign && (
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <Button size="sm" onClick={onAssign} disabled={assignCourier.isPending}>
            {assignCourier.isPending ? 'Assigning…' : 'Assign courier'}
          </Button>
          <p className="mt-2 text-xs text-neutral-400">
            Retries assignment on the existing Shipmozo order — tries your configured couriers in
            priority order. Won&apos;t create a duplicate.
          </p>
        </div>
      )}

      {/* Drop shipment: revert a manually-shipped order to its unshipped state,
          clearing the courier + AWB so it can be re-entered from scratch. */}
      {showDropButton && (
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={onDrop}
            disabled={dropShipment.isPending}
          >
            {dropShipment.isPending ? 'Dropping…' : 'Drop shipment'}
          </Button>
        </div>
      )}
    </div>
  );
}
