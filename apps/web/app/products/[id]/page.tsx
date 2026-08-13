import type { Product } from '@prime-kicks/types';
import type { Metadata } from 'next';
import ProductDetailClient from './product-detail-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// Server-side fetch so link crawlers (WhatsApp, Facebook, Google) get real
// Open Graph tags — the client page itself still fetches via React Query.
async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/products/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) return { title: 'Prime Kicks' };

  // Same sentence-case treatment the product cards use
  // (`lowercase [&::first-letter]:uppercase`): "Nike airforce mini red swoosh".
  const displayName = `${product.brand} ${product.name}`.toLowerCase();
  const sentenceName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const title = `${sentenceName} | Prime Kicks`;
  const description =
    product.description ||
    'An authentic Prime Kicks selection, inspected for quality and ready for its next rotation.';
  const image = product.photoUrls[0];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Prime Kicks',
      ...(image ? { images: [{ url: image, alt: sentenceName }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailClient id={id} />;
}
