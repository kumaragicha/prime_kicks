import type { Dimension } from './dimension';
import type { Size, SizeType } from './size';

export interface ProductVariant {
  id: string;
  productId: string;
  sizeId: string;
  size: Size;
  sku: string | null;
  stock: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  brandId: string | null;
  productTypes: { id: string; name: string; isActive: boolean }[];
  categories: { id: string; name: string; isActive: boolean }[];
  tags: { id: string; name: string; isActive: boolean }[];
  description: string;

  // Media
  photoUrls: string[];
  videoUrl: string | null;

  // Pricing in whole Indian rupees.
  //
  // `price` is the single, role-resolved selling price the API returns to every
  // caller (reseller price for RESELLER tokens, customer price otherwise). The
  // storefront renders this directly — it never branches on role itself.
  price: number;
  // The raw pricing breakdown below is ADMIN-only; storefront responses omit it
  // so the frontend can never expose more than one price. These are optional
  // because non-admin callers never receive them.
  inhouseCost?: number;
  resellerPrice?: number;
  customerPrice?: number;
  currency: 'INR';

  releaseYear: number | null;

  /** When false the product is hidden from the storefront but stays in the admin. */
  isActive: boolean;

  // Sizing
  sizeTypeId: string;
  sizeType: SizeType;
  variants: ProductVariant[];

  // Physical dimension — optional, at most one per product.
  dimensionId: string | null;
  dimension: Dimension | null;
  /** Sum of variant stock, computed by the API for convenience. */
  totalStock: number;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
