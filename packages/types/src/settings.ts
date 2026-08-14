export type ShipmozoSetting = {
  id: string;
  enabled: boolean;
  /** When true, a configured courier is auto-assigned after a successful push. */
  autoAssignCourier: boolean;
  warehouseId: string;
  skipStates: string[];
  /** Users whose orders push to Shipmozo but never auto-assign a courier. */
  autoAssignSkipUserIds: string[];
  createdAt: string;
  updatedAt: string;
};
