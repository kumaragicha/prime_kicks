import { WelcomeOfferModal } from '@/components/welcome-offer-modal';
import { Providers } from '@/providers';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import GoogleAnalyticsWrapper from './GoogleAnalytics';

/**
 * Allow users to zoom (WCAG 1.4.4). iOS Safari only auto-zooms on focus when an
 * input's font-size is < 16px, so keep form fields at ≥ 16px rather than
 * disabling zoom for everyone.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

const SITE_URL = 'https://primekicks.in';
const SITE_DESCRIPTION =
  'Discover premium sneakers and footwear at Prime Kicks. Shop the latest styles, new drops and exclusive collections.';
console.log('SITE_URL', SITE_URL);
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Prime Kicks | Premium Sneakers & Footwear.',
    template: '%s | Prime Kicks',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Prime Kicks',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Prime Kicks',
    title: 'Prime Kicks | Premium Sneakers & Footwear.',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prime Kicks | Premium Sneakers & Footwear.',
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    apple: '/apple-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Site-wide structured data: who runs the site (Organization) and the site
// entity itself (WebSite). Helps Google and AI engines resolve the brand.
const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Prime Kicks',
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  description: SITE_DESCRIPTION,
};

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Prime Kicks',
  url: SITE_URL,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="m-0 bg-paper text-ink font-[Arial,Helvetica,sans-serif]">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
        />
        <GoogleAnalyticsWrapper />

        <Providers>
          <WelcomeOfferModal />
          {children}
        </Providers>
      </body>
    </html>
  );
}
