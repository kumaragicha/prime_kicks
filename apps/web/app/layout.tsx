import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Prime Kicks',
  description:
    'Elevate your shoe game with Prime Kicks. Discover premium-quality shoes where exceptional style meets unmatched comfort',
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
