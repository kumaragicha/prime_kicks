import type { Metadata } from 'next';
import './globals.css';
import GoogleAnalyticsWrapper from './GoogleAnalytics';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://primekicks.in'),
  title: 'Prime Kicks',
  description:
    'Elevate your shoe game with Prime Kicks. Discover premium-quality shoes where exceptional style meets unmatched comfort',
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
