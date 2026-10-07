import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/providers';

/**
 * Lock the page scale so iOS Safari doesn't auto-zoom when a form field (which
 * can be < 16px) gains focus — same rationale as the public storefront.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: 'Prime Kicks Wholesale | Reseller Pricing.',
    template: '%s | Prime Kicks Wholesale',
  },
  description: 'Wholesale pricing and ordering for Prime Kicks reseller partners.',
  applicationName: 'Prime Kicks Wholesale',
  // Private domain — never index. Also enforced as an X-Robots-Tag header and
  // in robots.ts, since a stray crawler finding reseller rates would be a leak.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="m-0 bg-paper text-ink font-[Arial,Helvetica,sans-serif]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
