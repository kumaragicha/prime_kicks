import type { Product } from '@prime-kicks/types';
import type { Metadata } from 'next';
import { cache } from 'react';
import ProductDetailClient from '@/pages/product-detail-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const SITE_URL = 'https://primekicks.in';
const DEFAULT_DESCRIPTION =
  'An authentic Prime Kicks selection, inspected for quality and ready for its next rotation.';

// Server-side fetch so link crawlers (WhatsApp, Facebook, Google) and non-JS
// bots get real content, Open Graph tags and structured data. `cache` dedupes
// the call across generateMetadata and the page render within one request.
const fetchProduct = cache(async (id: string): Promise<Product | null> => {
  try {
    const res = await fetch(`${API_URL}/products/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
});

// Sentence-case treatment the product cards use: "Nike airforce mini red swoosh".
function displayName(product: Product): string {
  const lower = `${product.brand} ${product.name}`.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) return { title: 'Prime Kicks' };

  // Title is the product name only — the root layout template adds "| Prime Kicks".
  const title = displayName(product);
  const description = product.description || DEFAULT_DESCRIPTION;
  const image = product.photoUrls[0];

  return {
    title,
    description,
    alternates: {
      canonical: `/products/${id}`,
    },
    openGraph: {
      title: `${title} | Prime Kicks`,
      description,
      type: 'website',
      siteName: 'Prime Kicks',
      url: `${SITE_URL}/products/${id}`,
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${title} | Prime Kicks`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

// Product structured data so the page is eligible for Google rich results and
// free Shopping listings. Price is whole INR; availability from total stock.
function productJsonLd(product: Product, id: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: displayName(product),
    description: product.description || DEFAULT_DESCRIPTION,
    ...(product.photoUrls.length ? { image: product.photoUrls } : {}),
    brand: { '@type': 'Brand', name: product.brand },
    ...(product.sku ? { sku: product.sku } : {}),
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/products/${id}`,
      priceCurrency: product.currency,
      price: String(product.price),
      availability:
        product.totalStock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await fetchProduct(id);

  return (
    <>
      {product && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product, id)) }}
        />
      )}
      {/* Pass the server-fetched product so name, price and description render in
          the initial HTML instead of only after the client query resolves. */}
      <ProductDetailClient id={id} initialProduct={product ?? undefined} />
    </>
  );
}
