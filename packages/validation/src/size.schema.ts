import { z } from 'zod';

export const createSizeSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  conversion: z.string().min(1).nullable().default(null),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const updateSizeSchema = createSizeSchema.partial();

export const createSizeTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean().default(true),
  /** Optionally seed the type with its sizes in one call. */
  sizes: z.array(createSizeSchema).default([]),
});

export const updateSizeTypeSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export type CreateSizeSchema = z.infer<typeof createSizeSchema>;
export type UpdateSizeSchema = z.infer<typeof updateSizeSchema>;
export type CreateSizeTypeSchema = z.infer<typeof createSizeTypeSchema>;
export type UpdateSizeTypeSchema = z.infer<typeof updateSizeTypeSchema>;
