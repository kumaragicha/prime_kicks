import type { UserRole } from './user';

/** Order status constants — use these instead of raw string literals everywhere. */
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  APPROVED_PAYMENT_RECEIVED: 'APPROVED_PAYMENT_RECEIVED',
  APPROVED_PAYMENT_PENDING: 'APPROVED_PAYMENT_PENDING',
  REJECTED: 'REJECTED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** Payment status constants — used for both paymentStatus and shippingStatus. */
export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** Order type constants. */
export const ORDER_TYPE = {
  BULK: 'BULK',
  SINGLE: 'SINGLE',
} as const;

export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

/** Shipmozo shipment lifecycle — mirrors the API's ShipmentStatus enum. */
export const SHIPMENT_STATUS = {
  NOT_SHIPPED: 'NOT_SHIPPED',
  PUSHED: 'PUSHED',
  ASSIGNED: 'ASSIGNED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS)[keyof typeof SHIPMENT_STATUS];

/**
 * An order's Shipmozo shipment. Customers receive only the courier/tracking/
 * status; the Shipmozo ids and last error are admin-only (optional here).
 */
export interface OrderShipment {
  status: ShipmentStatus;
  courierPartner: string | null;
  trackingId: string | null;
  pushedAt: string | null;
  shipmozoOrderId?: string | null;
  shipmozoReferenceId?: string | null;
  error?: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  title: string;
  sku: string;
  sizeLabel: string | null;
  quantity: number;
  unitPrice: number;
  product: {
    photoUrls: string[];
  };
}

export interface OrderAddress {
  name: string;
  email: string | null;
  altMobileNo: string | null;
  mobileNo: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  orderType: OrderType;
  shippingStatus: PaymentStatus;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  currency: 'INR';
  address: OrderAddress;
  shipment: OrderShipment;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  userName: string;
  /** Order owner's account role — shown under the name. 'CREDIT' = a bulk
   *  credit-customer account (not a login user). */
  userRole: UserRole | 'CREDIT';
  /** Delivery/recipient contact name (from the shipping address). Shown under
   *  the orderer's name for reseller orders, where the two often differ. */
  deliveryName: string | null;
  status: OrderStatus;
  shipmentStatus: ShipmentStatus;
  /** AWB / tracking number once a courier is assigned, else null. */
  trackingId: string | null;
  /** Assigned courier name once a courier is assigned, else null. */
  courierPartner: string | null;
  itemsCount: number;
  total: number;
  currency: string;
  createdAt: string;
}

export type CreateOrderInput = {
  userId: string;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
};
