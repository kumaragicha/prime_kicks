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
export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        // Upper bound keeps a single line from overflowing the Int price columns.
        quantity: z.number().int().positive().max(100_000),
      }),
    )
    .min(1, 'An order needs at least one item')
    .max(500, 'An order cannot contain more than 500 line items'),
  address: addressSchema,
  // --- Admin-only fields (optional; when omitted the web/customer flow is used) ---
  resellerId: z.string().min(1, 'Select a reseller').optional(),
  orderType: orderTypeSchema.optional().default('SINGLE'),
  paymentStatus: paymentStatusSchema.optional().default('PENDING'),
  shippingStatus: paymentStatusSchema.optional().default('PENDING'),
  shipping: z.number().int().nonnegative().max(10_000_000).optional().default(0),
});

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: orderStatusSchema.optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export type CreateOrderSchema = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusSchema = z.infer<typeof updateOrderStatusSchema>;
export type OrderQuerySchema = z.infer<typeof orderQuerySchema>;
