export type ShipmozoSetting = {
  id: string;
  enabled: boolean;
  /** When true, a configured courier is auto-assigned after a successful push. */
  autoAssignCourier: boolean;
  warehouseId: string;
  skipStates: string[];
  createdAt: string;
  updatedAt: string;
};
