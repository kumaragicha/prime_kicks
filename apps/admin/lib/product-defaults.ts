import type { Product } from '@prime-kicks/types';
import type { CreateProductSchema } from '@prime-kicks/validation';
import type { DefaultValues } from 'react-hook-form';

/**
 * Project a saved product back onto the shape `ProductForm` expects. Used by the
 * edit page, and — via {@link duplicateFormDefaults} — to seed a new product from
 * an existing one.
 *
 * `ProductForm` reads its defaults once, at mount, so callers must have the
 * product in hand before rendering the form (or remount it with a `key`).
 */
export function productFormDefaults(product: Product): DefaultValues<CreateProductSchema> {
  return {
    sku: product.sku,
    name: product.name,
    brandId: product.brandId ?? '',
    model: product.model ?? null,
    productTypeIds: product.productTypes.map((type) => type.id),
    categoryIds: product.categories.map((category) => category.id),
    tagIds: product.tags?.map((tag) => tag.id) ?? [],
    description: product.description,
    currency: product.currency,
    photoUrls: product.photoUrls,
    videoUrl: product.videoUrl,
    releaseYear: product.releaseYear,
    inhouseCost: product.inhouseCost,
    resellerPrice: product.resellerPrice,
    customerPrice: product.customerPrice,
    sizeTypeId: product.sizeTypeId,
    variants: product.variants.map((v) => ({ sizeId: v.sizeId, stock: v.stock, sku: v.sku })),
    dimensionId: product.dimensionId ?? null,
  };
}

/**
 * The same projection, minus the fields that identify one specific row: SKUs are
 * unique per product, so the product's own SKU and its per-variant SKUs are
 * dropped (`ProductForm` generates a fresh one from the brand on submit).
 *
 * Everything else carries over, media included — the whole point is to keep the
 * config and swap the photos, so the new row starts from a complete product
 * rather than a half-filled form. The page shows which product it copied and
 * offers a one-click way back to a blank form.
 *
 * The name gets a "(copy)" suffix because the API rejects two products with the
 * same name under one brand: saving the copy untouched would otherwise always
 * fail. Rename it to the real colourway before saving.
 */
export function duplicateFormDefaults(product: Product): DefaultValues<CreateProductSchema> {
  return {
    ...productFormDefaults(product),
    name: `${product.name} (copy)`,
    sku: '',
    variants: product.variants.map((v) => ({ sizeId: v.sizeId, stock: v.stock, sku: null })),
  };
}
