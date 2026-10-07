'use client';

import { Announcement } from '@/components/announcement';
import { OrderSuccess } from '@/components/order-success';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Confirmed() {
  const params = useSearchParams();
  const orderNumber = params.get('order') ?? '';
  return <OrderSuccess orderNumber={orderNumber} />;
}

export default function OrderConfirmedPage() {
  return (
    <main>
      <Announcement />
      <SiteHeader />
      <Suspense fallback={null}>
        <Confirmed />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
