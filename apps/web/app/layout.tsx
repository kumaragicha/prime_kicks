import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Prime Kicks',
  description: 'Buy and sell authenticated sneakers.',
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
