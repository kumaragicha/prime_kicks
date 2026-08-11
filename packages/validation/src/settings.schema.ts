import { z } from 'zod';

/** Admin-editable Shipmozo integration settings. All fields optional (partial update). */
export const updateShipmozoSettingSchema = z.object({
  enabled: z.boolean().optional(),
  /** When true, a configured courier is auto-assigned after a successful push. */
  autoAssignCourier: z.boolean().optional(),
  warehouseId: z.string().trim().max(64).optional(),
  // States (shipping address) whose orders must NOT be pushed to Shipmozo.
  skipStates: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
});

export type UpdateShipmozoSettingSchema = z.infer<typeof updateShipmozoSettingSchema>;
