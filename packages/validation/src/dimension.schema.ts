import { z } from 'zod';

/** A physical dimension master. Measurements are in centimetres. */
export const createDimensionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  weight: z.number().positive('Weight (kg) must be greater than 0'),
  length: z.number().positive('Length must be greater than 0'),
  width: z.number().positive('Width must be greater than 0'),
  height: z.number().positive('Height must be greater than 0'),
  isActive: z.boolean().default(true),
});

export const updateDimensionSchema = createDimensionSchema.partial();

export type CreateDimensionSchema = z.infer<typeof createDimensionSchema>;
export type UpdateDimensionSchema = z.infer<typeof updateDimensionSchema>;

/** One recipe line of a combination: a dimension and how many of it. */
export const dimensionCombinationItemSchema = z.object({
  dimensionId: z.string().min(1, 'Pick a dimension'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const createDimensionCombinationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  weight: z.number().positive('Weight (kg) must be greater than 0'),
  boxDimensionId: z.string().min(1, 'Pick the box dimension to apply'),
  isActive: z.boolean().default(true),
  items: z
    .array(dimensionCombinationItemSchema)
    .min(1, 'Add at least one dimension to the combination'),
});

export const updateDimensionCombinationSchema = createDimensionCombinationSchema.partial();

export type DimensionCombinationItemSchema = z.infer<typeof dimensionCombinationItemSchema>;
export type CreateDimensionCombinationSchema = z.infer<typeof createDimensionCombinationSchema>;
export type UpdateDimensionCombinationSchema = z.infer<typeof updateDimensionCombinationSchema>;
