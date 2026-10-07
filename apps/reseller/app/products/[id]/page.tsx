import ProductDetailClient from '@/pages/product-detail-client';

/**
 * No server-side Open Graph fetch here, unlike the public storefront: this
 * domain is noindex and never link-previewed, and that fetch runs without the
 * `x-storefront` header — so it would render retail prices into the metadata.
 * The client component fetches through the shared API layer, which does send
 * the header and therefore renders reseller pricing.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailClient id={id} />;
}
