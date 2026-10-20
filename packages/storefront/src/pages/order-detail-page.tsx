'use client';

import { customerOrderStatus, OrderDetails } from '@/components/order-details';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { useCurrentUser, useMyOrders } from '@/lib/hooks';
import { formatCurrency, formatOrderId } from '@prime-kicks/utils';
import Link from 'next/link';

const WHATSAPP_HELP_URL = 'https://api.whatsapp.com/send?phone=918866929090';

/**
 * Customer site: full details of one order, opened from My orders. Uses the
 * same cached "my orders" data as the list, so it opens instantly.
 */
export default function OrderDetailPage({ id }: { id: string }) {
  const { user, hydrated } = useCurrentUser();
  const { data: orders, isLoading } = useMyOrders();
  const order = orders?.find((o) => o.id === id) ?? null;

  const backLink = (
    <Link
      href="/orders"
      className="mb-[16px] inline-flex items-center gap-[6px] text-[10px] font-bold uppercase tracking-[.12em] text-[#999] no-underline transition-colors hover:text-white"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-[13px] w-[13px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m15 6-6 6 6 6" />
      </svg>
      My orders
    </Link>
  );

  let body: React.ReactNode;
  if (!hydrated || isLoading) {
    body = (
      <div className="flex items-center gap-[10px] text-[13px] text-[#666]">
        <i className="inline-block h-[14px] w-[14px] animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-[#ccc] border-t-[#111]" />
        Loading order…
      </div>
    );
  } else if (!user) {
    body = <p className="m-0 text-[15px] text-[#666]">Sign in to view this order.</p>;
  } else if (!order) {
    body = (
      <div className="py-[30px] text-center">
        <p className="m-0 mb-[18px] text-[15px] text-[#666]">We couldn&apos;t find this order.</p>
        <Link
          href="/orders"
          className="inline-flex items-center rounded-[8px] bg-ink px-[15px] py-[13px] text-[10px] font-bold uppercase tracking-[.07em] text-white no-underline"
        >
          Back to my orders
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <OrderDetails order={order} />
        <p className="mt-[22px] text-center text-[11.5px] text-[#888]">
          Questions about this order?{' '}
          <a
            href={WHATSAPP_HELP_URL}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-ink underline underline-offset-2"
          >
            Chat with us on WhatsApp
          </a>
        </p>
      </>
    );
  }

  const status = order ? customerOrderStatus(order) : null;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-paper">
        <section className="bg-[#111] px-[5.25vw] pb-[34px] pt-[44px] text-white max-[700px]:px-[15px] max-[700px]:py-[30px]">
          <div className="mx-auto max-w-[720px]">
            {backLink}
            <div className="flex flex-wrap items-end justify-between gap-[12px]">
              <div>
                <p className="m-0 mb-[6px] text-[10px] font-bold uppercase tracking-[.16em] text-accent">
                  Order details
                </p>
                <h1 className="m-0 text-[clamp(30px,4vw,48px)] leading-[.9] tracking-[-.06em]">
                  {order ? formatOrderId(order.orderNumber) : 'Your order'}
                </h1>
                {order && (
                  <p className="m-0 mt-[8px] text-[13px] text-[#999]">
                    Placed on{' '}
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    · {formatCurrency(order.total, order.currency)}
                  </p>
                )}
              </div>
              {status && (
                <span
                  className={`rounded px-[9px] py-[4px] text-[10px] font-bold uppercase tracking-[.08em] ${status.className}`}
                >
                  {status.label}
                </span>
              )}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[720px] px-[5.25vw] pb-[80px] pt-[28px] max-[700px]:px-[15px]">
          {body}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
