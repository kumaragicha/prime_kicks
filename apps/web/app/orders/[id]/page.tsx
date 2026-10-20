// Customer site only (the reseller app has no order details route).
// Implementation lives in packages/storefront/src/pages/order-detail-page.tsx.
import type { Metadata } from 'next';
import OrderDetailPage from '@/pages/order-detail-page';

// A customer's private order — never indexed.
export const metadata: Metadata = {
  title: 'Order details',
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailPage id={id} />;
}
