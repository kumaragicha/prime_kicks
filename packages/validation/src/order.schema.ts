import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'PENDING',
  'APPROVED_PAYMENT_RECEIVED',
  'APPROVED_PAYMENT_PENDING',
  'REJECTED',
]);

export const paymentStatusSchema = z.enum(['PENDING', 'RECEIVED']);

export const orderTypeSchema = z.enum(['BULK', 'SINGLE']);

export const addressSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  altMobileNo: z
    .string()
    .min(10, 'Alternative mobile number must be at least 10 digits')
    .optional()
    .or(z.literal('')),
  mobileNo: z.string().min(10, 'Mobile number is required'),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional().default(''),
  landmark: z.string().optional().default(''),
  pincode: z.string().min(6, 'Valid pincode is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
});

/** Single schema for all order creation — web (customer) and admin (reseller).
 *  When `resellerId` is present the order is treated as admin-created:
 *  - the reseller's price is used instead of the customer price
 *  - the order is pre-approved (status follows paymentStatus)
 *  - the user's cart is NOT cleared
 */
export const createOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          variantId: z.string().min(1),
          // Upper bound keeps a single line from overflowing the Int price columns.
          quantity: z.number().int().positive().max(100_000),
          // Manual unit rate (₹). Required for bulk/credit orders, ignored otherwise
          // (normal orders derive the price from the product).
          unitPrice: z.number().int().positive().max(10_000_000).optional(),
        }),
      )
      .min(1, 'An order needs at least one item')
      .max(500, 'An order cannot contain more than 500 line items'),
    // Pickup orders (reseller selects "I'll pick up" at checkout) don't need a
    // shipping address — the customer collects the order in store. The service
    // defaults to false when omitted.
    isPickup: z.boolean().optional(),
    address: addressSchema.optional(),
    // --- Admin-only fields (optional; when omitted the web/customer flow is used) ---
    resellerId: z.string().min(1, 'Select a reseller').optional(),
    // A bulk order billed to a non-login CreditCustomer (mutually exclusive with resellerId).
    creditCustomerId: z.string().min(1).optional(),
    orderType: orderTypeSchema.optional().default('SINGLE'),
    paymentStatus: paymentStatusSchema.optional().default('PENDING'),
    shippingStatus: paymentStatusSchema.optional().default('PENDING'),
    shipping: z.number().int().nonnegative().max(10_000_000).optional().default(0),
  })
  .superRefine((val, ctx) => {
    // Shipping orders must carry a delivery address; pickup orders must not.
    if (!val.isPickup && !val.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A shipping address is required.',
        path: ['address'],
      });
    }
    if (val.resellerId && val.creditCustomerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An order cannot have both a reseller and a credit customer.',
        path: ['creditCustomerId'],
      });
    }
    // Bulk (credit-customer) orders require a manual rate on every line.
    if (val.creditCustomerId) {
      val.items.forEach((item, i) => {
        if (item.unitPrice == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'A rate is required for each bulk order line.',
            path: ['items', i, 'unitPrice'],
          });
        }
      });
    }
  });

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
});

/** Manually mark an order as shipped with a local courier + AWB (no Shipmozo). */
export const manualShipmentSchema = z.object({
  courierPartner: z.string().trim().min(1, 'Courier name is required').max(64),
  trackingId: z.string().trim().min(1, 'AWB / tracking number is required').max(64),
});

/** Attach an existing Shipmozo order to ours by its Shipmozo order id. */
export const attachShipmozoOrderSchema = z.object({
  shipmozoOrderId: z.string().trim().min(1, 'Shipmozo order id is required').max(64),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: orderStatusSchema.optional(),
  // Inclusive created-at range as IST calendar days (YYYY-MM-DD). endDate
  // covers the whole day. Resolved to UTC instants in the service layer.
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export type CreateOrderSchema = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusSchema = z.infer<typeof updateOrderStatusSchema>;
export type ManualShipmentSchema = z.infer<typeof manualShipmentSchema>;
export type AttachShipmozoOrderSchema = z.infer<typeof attachShipmozoOrderSchema>;
export type OrderQuerySchema = z.infer<typeof orderQuerySchema>;
