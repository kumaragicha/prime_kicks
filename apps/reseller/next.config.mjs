/** @type {import('next').NextConfig} */

// Same baseline as the public storefront, plus X-Robots-Tag: this app is served
// on a private domain shared only with wholesale partners, so it must never be
// indexed — reseller pricing showing up in search results would be a leak.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  transpilePackages: [
    '@prime-kicks/storefront',
    '@prime-kicks/ui',
    '@prime-kicks/utils',
    '@prime-kicks/types',
    '@prime-kicks/validation',
  ],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
