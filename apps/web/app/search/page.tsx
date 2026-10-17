// Implementation is shared with the reseller app — see
// packages/storefront/src/pages/search-page.tsx
import type { Metadata } from 'next';

// Internal search results are thin and near-duplicate across queries, so keep
// them out of the index (but let crawlers follow links to real product pages).
export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
};

export { default } from '@/pages/search-page';
