import { z } from 'zod';

/** One size row on a product: which size, how many in stock, optional own SKU. */
export const productVariantInputSchema = z.object({
  sizeId: z.string().min(1, 'sizeId is required'),
  stock: z.number().int().nonnegative().default(0),
  sku: z.string().min(1).nullable().default(null),
});

export const createProductSchema = z.object({
  sku: z.string().default(''),
  name: z.string().min(1, 'Name is required'),
  brandId: z.string().min(1, 'Pick a brand'),
  productTypeIds: z.array(z.string().min(1)).min(1, 'Pick at least one product type'),
  categoryIds: z.array(z.string().min(1)).min(1, 'Pick at least one category'),
  tagIds: z.array(z.string().min(1)).default([]),
  description: z.string().default(''),

  // Media
  photoUrls: z
    .array(z.string().url('Each photo must be a valid URL'))
    .max(4, 'Up to 4 photos')
    .default([]),
  videoUrl: z.string().url('Video must be a valid URL').nullable().default(null),

  // Pricing in whole Indian rupees.
  inhouseCost: z.number().int().nonnegative(),
  resellerPrice: z.number().int().nonnegative(),
  customerPrice: z.number().int().nonnegative(),
  currency: z.literal('INR').default('INR'),

  releaseYear: z.number().int().min(1970).max(2100).nullable().default(null),

  // Sizing
  sizeTypeId: z.string().min(1, 'Pick a size type'),
  variants: z.array(productVariantInputSchema).default([]),

  // Physical dimension — optional, at most one per product.
  dimensionId: z.string().min(1).nullable().default(null),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  /** Filter by tag name (case-insensitive) — used by the curated homepage sections. */
  tag: z.string().optional(),
  sizeTypeId: z.string().optional(),
  /** Filter to products that have this size label in stock (e.g. "40"). */
  size: z.string().optional(),
  search: z.string().optional(),
});

export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;
export type CreateProductSchema = z.infer<typeof createProductSchema>;
export type UpdateProductSchema = z.infer<typeof updateProductSchema>;
export type ProductQuerySchema = z.infer<typeof productQuerySchema>;
