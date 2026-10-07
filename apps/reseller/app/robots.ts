import type { MetadataRoute } from 'next';

/** Private wholesale domain — disallow everything, for every crawler. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
