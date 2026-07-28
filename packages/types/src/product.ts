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
  description: string;

  // Media
  photoUrls: string[];
  videoUrl: string | null;

  // Pricing in whole Indian rupees.
  inhouseCost: number;
  resellerPrice: number;
  customerPrice: number;
  currency: 'INR';

  releaseYear: number | null;

  // Sizing
  sizeTypeId: string;
  sizeType: SizeType;
  variants: ProductVariant[];
  /** Sum of variant stock, computed by the API for convenience. */
  totalStock: number;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
