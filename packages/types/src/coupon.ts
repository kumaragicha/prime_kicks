export type CouponType = 'PERCENT' | 'FLAT';

/** A discount coupon as managed in the admin. Dates are ISO strings. */
export interface Coupon {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  /** PERCENT: 1–100. FLAT: whole rupees. */
  value: number;
  /** PERCENT only: rupee cap on the discount (null = uncapped). */
  maxDiscount: number | null;
  minOrderValue: number;
  customerOnly: boolean;
  prepaidOnly: boolean;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Result of validating a coupon against a cart (storefront preview). */
export interface CouponPreview {
  code: string;
  type: CouponType;
  value: number;
  /** Discount in whole rupees that would be applied. */
  discount: number;
  /** True when the coupon only applies to orders paid fully online. */
  prepaidOnly: boolean;
  subtotal: number;
  total: number;
}
