import type { MetadataRoute } from 'next';

const SITE_URL = 'https://primekicks.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep private / transactional pages out of the index.
        disallow: ['/cart', '/order-confirmed', '/orders', '/profile', '/reset-password'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
