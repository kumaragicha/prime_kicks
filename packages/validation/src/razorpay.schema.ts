import { z } from 'zod';
import { addressSchema } from './order.schema.js';

/**
 * Body for POST /payments/razorpay/order — start a Razorpay checkout session
 * for a plain web customer's cart. No Order exists yet at this point (and
 * none is created until payment is confirmed) — this just prices the cart and
 * opens a Razorpay order for that amount. Web storefront only: no
 * resellerId/creditCustomerId/admin-only fields, those flows never pay via
 * Razorpay (see OrdersService.create()).
 */
export const startRazorpayCheckoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          variantId: z.string().min(1),
          quantity: z.number().int().positive().max(100_000),
        }),
      )
      .min(1, 'An order needs at least one item')
      .max(500, 'An order cannot contain more than 500 line items'),
    // Pickup is only honoured for RESELLER/ADMIN accounts (enforced server-side,
    // not here — this schema has no user context); a plain customer's isPickup
    // is always ignored and an address is required regardless.
    isPickup: z.boolean().optional(),
    address: addressSchema.optional(),
    // Optional coupon code (customer, prepaid only). Validated server-side; an
    // invalid/ineligible code fails the checkout rather than being silently dropped.
    couponCode: z.string().trim().max(32).optional(),
    // ONLINE pays the full total now; COD pays a 20% advance now and the rest
    // in cash on delivery (see splitPayment in @prime-kicks/types).
    paymentMethod: z.enum(['ONLINE', 'COD']).optional().default('ONLINE'),
  })
  .superRefine((val, ctx) => {
    if (!val.isPickup && !val.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A shipping address is required.',
        path: ['address'],
      });
    }
  });

/**
 * Body for POST /payments/razorpay/verify — the fields Razorpay Checkout's
 * success handler hands back to the client. No orderId: at this point no
 * Order exists yet, so confirmation looks the checkout session up by
 * razorpay_order_id instead.
 */
export const verifyRazorpayPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/** Query for GET /payments/razorpay — the admin-only read-only payments table. */
export const razorpayPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type StartRazorpayCheckoutSchema = z.infer<typeof startRazorpayCheckoutSchema>;
export type VerifyRazorpayPaymentSchema = z.infer<typeof verifyRazorpayPaymentSchema>;
export type RazorpayPaymentsQuerySchema = z.infer<typeof razorpayPaymentsQuerySchema>;
