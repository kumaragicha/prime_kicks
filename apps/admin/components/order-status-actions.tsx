'use client';

import {
  ORDER_STATUS,
  SHIPMENT_STATUS,
  type OrderStatus,
  type ShipmentStatus,
} from '@prime-kicks/types';
import type { ReactNode } from 'react';
import { CheckIcon, ClockIcon, CloseIcon, IconButton, UndoIcon } from './action-controls';

type Tone = 'default' | 'danger' | 'success' | 'warning';

export type OrderStatusAction = {
  status: OrderStatus;
  /** Short label shown in the button tooltip. */
  label: string;
  /** Sentence describing the effect, used in the confirm dialog. */
  effect: string;
  tone: Tone;
  icon: ReactNode;
};

/**
 * The four order statuses as transition targets, in workflow order. Rendering
 * "every status except the current one" gives admins free back-and-forth
 * movement between statuses from a single, consistent control.
 */
export const ORDER_STATUS_ACTIONS: OrderStatusAction[] = [
  {
    status: ORDER_STATUS.APPROVED_PAYMENT_RECEIVED,
    label: 'Approve — payment received',
    effect: 'mark it approved with payment received (order complete)',
    tone: 'success',
    icon: <CheckIcon />,
  },
  {
    status: ORDER_STATUS.APPROVED_PAYMENT_PENDING,
    label: 'Approve — payment pending (credit)',
    effect: 'mark it approved with payment pending (dispatched on credit)',
    tone: 'warning',
    icon: <ClockIcon />,
  },
  {
    status: ORDER_STATUS.PENDING,
    label: 'Move back to pending',
    effect: 'move it back to pending',
    tone: 'default',
    icon: <UndoIcon />,
  },
  {
    status: ORDER_STATUS.REJECTED,
    label: 'Reject order',
    effect: 'reject it and restore its stock to inventory',
    tone: 'danger',
    icon: <CloseIcon />,
  },
];

/** Row/detail action set: an icon button per status other than the current one. */
export function OrderStatusActions({
  current,
  onSelect,
  disabled = false,
  stopPropagation = false,
  shipmentStatus,
  hideStatuses = [],
}: {
  current: OrderStatus;
  onSelect: (action: OrderStatusAction) => void;
  disabled?: boolean;
  stopPropagation?: boolean;
  /** The order's shipment status — locks down transitions once it's shipped. */
  shipmentStatus?: ShipmentStatus;
  /** Transition targets to never render (e.g. hide "Reject" on the payments page). */
  hideStatuses?: OrderStatus[];
}) {
  // Once a paid order has a courier assigned (shipped), the only sensible moves
  // are undo (back to pending) or delete — so hide "payment pending" and
  // "reject" for an APPROVED_PAYMENT_RECEIVED order whose shipment is ASSIGNED.
  const lockedForShipped =
    current === ORDER_STATUS.APPROVED_PAYMENT_RECEIVED &&
    shipmentStatus === SHIPMENT_STATUS.ASSIGNED;

  return (
    <>
      {ORDER_STATUS_ACTIONS.filter((action) => {
        if (action.status === current) return false;
        if (hideStatuses.includes(action.status)) return false;
        if (
          lockedForShipped &&
          (action.status === ORDER_STATUS.APPROVED_PAYMENT_PENDING ||
            action.status === ORDER_STATUS.REJECTED)
        ) {
          return false;
        }
        return true;
      }).map((action) => (
        <IconButton
          key={action.status}
          label={action.label}
          tone={action.tone}
          disabled={disabled}
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
            onSelect(action);
          }}
        >
          {action.icon}
        </IconButton>
      ))}
    </>
  );
}
