/** @type {import('next').NextConfig} */

// Safe baseline security headers (no strict CSP — that needs per-app tuning to
// avoid breaking inline styles / external images). HSTS only takes effect over
// HTTPS and is harmless otherwise.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework.
  poweredByHeader: false,
  compiler: {
    // Strip console.* in production builds, keeping error/warn for observability.
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  transpilePackages: [
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
