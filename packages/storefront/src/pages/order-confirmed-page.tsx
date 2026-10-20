'use client';

import { Announcement } from '@/components/announcement';
import { CustomerOrderSuccess } from '@/components/customer-order-success';
import { OrderSuccess } from '@/components/order-success';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Confirmed() {
  const params = useSearchParams();
  const orderNumber = params.get('order') ?? '';
  // Customer site: payment is already done, so show the confirmation + order
  // details. The reseller site keeps its WhatsApp-to-pay screen unchanged.
  return process.env.NEXT_PUBLIC_STOREFRONT === 'reseller' ? (
    <OrderSuccess orderNumber={orderNumber} />
  ) : (
    <CustomerOrderSuccess orderNumber={orderNumber} />
  );
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
