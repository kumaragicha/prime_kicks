import { z } from 'zod';

export const couponTypeSchema = z.enum(['PERCENT', 'FLAT']);

/** A coupon code: letters/numbers/-/_ only, stored uppercased by the service. */
const codeSchema = z
  .string()
  .trim()
  .min(3, 'Code must be at least 3 characters')
  .max(32, 'Code must be at most 32 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'Use only letters, numbers, - and _');

// Accept '' or a date string from <input type="date"> / ISO; empty → undefined.
const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? v : undefined));

/** Admin create/update payload for a coupon. */
export const createCouponSchema = z
  .object({
    code: codeSchema,
    description: z.string().trim().max(200).optional().default(''),
    type: couponTypeSchema.default('PERCENT'),
    // PERCENT: 1–100. FLAT: whole rupees (≥ 1).
    value: z.number().int().positive().max(10_000_000),
    maxDiscount: z.number().int().positive().max(10_000_000).optional().nullable(),
    minOrderValue: z.number().int().nonnegative().max(10_000_000).optional().default(0),
    customerOnly: z.boolean().optional().default(true),
    prepaidOnly: z.boolean().optional().default(true),
    usageLimit: z.number().int().positive().max(10_000_000).optional().nullable(),
    perUserLimit: z.number().int().positive().max(100_000).optional().nullable(),
    validFrom: optionalDate,
    validUntil: optionalDate,
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'PERCENT' && val.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A percentage discount cannot exceed 100.',
        path: ['value'],
      });
    }
    if (val.validFrom && val.validUntil && val.validFrom > val.validUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The start date must be before the end date.',
        path: ['validUntil'],
      });
    }
  });

/** All fields optional on update (code may be renamed). */
export const updateCouponSchema = createCouponSchema.innerType().partial();

/** Storefront: preview a coupon against the current cart before paying. */
export const applyCouponSchema = z.object({
  code: codeSchema,
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1),
        quantity: z.number().int().positive().max(100_000),
      }),
    )
    .min(1, 'Your bag is empty'),
});

export const couponQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
});

export type CouponTypeSchema = z.infer<typeof couponTypeSchema>;
export type CreateCouponSchema = z.infer<typeof createCouponSchema>;
export type UpdateCouponSchema = z.infer<typeof updateCouponSchema>;
export type ApplyCouponSchema = z.infer<typeof applyCouponSchema>;
export type CouponQuerySchema = z.infer<typeof couponQuerySchema>;
