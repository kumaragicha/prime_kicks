export type CourierConfig = {
  id: string;
  weightSlab: string;
  courierCompanyId: string;
  courierCompanyServiceTypeId: string;
  label: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateCourierConfig = {
  weightSlab: string;
  courierCompanyId: string;
  courierCompanyServiceTypeId: string;
  label?: string | null;
  priority?: number;
};

export type UpdateCourierConfig = {
  courierCompanyId?: string;
  courierCompanyServiceTypeId?: string;
  label?: string | null;
  priority?: number;
};
