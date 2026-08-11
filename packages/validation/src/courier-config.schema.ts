import { z } from 'zod';

/** The weight slabs currently supported by the Shipmozo courier mapping. */
export const courierWeightSlabSchema = z.enum(['1kg', '2kg', '5kg']);

const shipmozoIdSchema = z
  .string()
  .trim()
  .min(1, 'This ID is required.')
  .max(64)
  .regex(/^\d+$/, 'Enter the numeric ID shown in Shipmozo.');

export const createCourierConfigSchema = z.object({
  weightSlab: courierWeightSlabSchema,
  courierCompanyId: shipmozoIdSchema,
  courierCompanyServiceTypeId: shipmozoIdSchema,
  label: z.string().trim().min(1).max(100).nullable().optional(),
  priority: z.number().int().nonnegative().optional(),
});

export const updateCourierConfigSchema = createCourierConfigSchema
  .omit({ weightSlab: true })
  .partial();

export type CreateCourierConfigSchema = z.infer<typeof createCourierConfigSchema>;
export type UpdateCourierConfigSchema = z.infer<typeof updateCourierConfigSchema>;
