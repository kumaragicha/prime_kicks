import type { Metadata } from 'next';
import './globals.css';
import GoogleAnalyticsWrapper from './GoogleAnalytics';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://primekicks.in'),
  title: {
    default: 'Prime Kicks | Premium Sneakers & Footwear.',
    template: '%s | Prime Kicks',
  },
  description:
    'Discover premium sneakers and footwear at Prime Kicks. Shop the latest styles, new drops and exclusive collections.',

  applicationName: 'Prime Kicks',
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  console.log('process.env.NEXT_PUBLIC_GA_ID', process.env.NEXT_PUBLIC_GA_ID);
  return (
    <html lang="en" className="scroll-smooth">
      <body className="m-0 bg-paper text-ink font-[Arial,Helvetica,sans-serif]">
        <GoogleAnalyticsWrapper />

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
