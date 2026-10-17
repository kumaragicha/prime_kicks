import type { Paginated, Product } from '@prime-kicks/types';
import type { MetadataRoute } from 'next';

const SITE_URL = 'https://primekicks.in';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// Revalidate the sitemap hourly so new products appear without a redeploy.
export const revalidate = 3600;

type StaticRoute = {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
};

// Static, indexable pages. `/search` is intentionally excluded — internal search
// results are noindex (thin, near-duplicate), so they don't belong in the sitemap.
const STATIC_ROUTES: StaticRoute[] = [
  { path: '', priority: 1.0, changeFrequency: 'daily' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/shipping-returns', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changeFrequency: 'yearly' },
];

/** Fetch every active product so each one gets a sitemap entry. */
async function fetchAllProducts(): Promise<Pick<Product, 'id' | 'updatedAt'>[]> {
  const pageSize = 100;
  const products: Pick<Product, 'id' | 'updatedAt'>[] = [];

  try {
    let page = 1;
    let totalPages = 1;

    do {
      const res = await fetch(`${API_URL}/products?page=${page}&pageSize=${pageSize}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;

      const body = (await res.json()) as Paginated<Product>;
      for (const product of body.data) {
        products.push({ id: product.id, updatedAt: product.updatedAt });
      }
      totalPages = body.meta?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
  } catch {
    // Never let a transient API error break sitemap generation — fall back to
    // whatever (static + any products already collected) we have.
  }

  return products;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const products = await fetchAllProducts();
  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}/products/${product.id}`,
    lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
