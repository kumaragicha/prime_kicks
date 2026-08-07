import { z } from 'zod';

/** A physical dimension master. Measurements are in centimetres. */
export const createDimensionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  length: z.number().positive('Length must be greater than 0'),
  width: z.number().positive('Width must be greater than 0'),
  height: z.number().positive('Height must be greater than 0'),
  isActive: z.boolean().default(true),
});

export const updateDimensionSchema = createDimensionSchema.partial();

export type CreateDimensionSchema = z.infer<typeof createDimensionSchema>;
export type UpdateDimensionSchema = z.infer<typeof updateDimensionSchema>;
