'use client';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { useCurrentUser, useMyOrders } from '@/lib/hooks';
import { ORDER_STATUS, type Order } from '@prime-kicks/types';
import { formatCurrency } from '@prime-kicks/utils';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED_PAYMENT_RECEIVED: 'Approved · Payment Received',
  APPROVED_PAYMENT_PENDING: 'Approved · Payment Pending',
  REJECTED: 'Rejected',
};

function OrderCard({ order }: { order: Order }) {
  const [copied, setCopied] = useState(false);

  function copyTracking(value: string) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="border border-line bg-white p-[22px] max-[700px]:px-[15px]">
      <div className="flex items-start justify-between mb-[14px]">
        <div>
          <p className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] m-0 mb-[3px]">
            {order.orderNumber}
          </p>
          <p className="text-[11px] text-[#555] m-0">
            {new Date(order.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <span
          className={`text-[9px] uppercase font-bold tracking-[.08em] px-[8px] py-[3px] rounded ${
            order.status === ORDER_STATUS.APPROVED_PAYMENT_RECEIVED
              ? 'bg-green-100 text-green-800'
              : order.status === ORDER_STATUS.REJECTED
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-line border-y border-line">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center gap-[14px] py-[10px]">
            <Link
              href={`/products/${item.productId}`}
              className="flex-shrink-0 block w-[88px] h-[88px] rounded overflow-hidden bg-[#f0eee9]"
            >
              {item.product.photoUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.product.photoUrls[0]}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/products/${item.productId}`}
                className="text-[13px] font-medium text-ink no-underline hover:underline underline-offset-2 line-clamp-2 m-0"
              >
                {item.title}
              </Link>
              {item.sizeLabel && (
                <p className="text-[11px] text-[#777] m-0 mt-[2px]">Size {item.sizeLabel}</p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[13px] font-medium text-ink m-0">
                {formatCurrency(item.unitPrice * item.quantity, order.currency)}
              </p>
              {item.quantity > 1 && (
                <p className="text-[10px] text-[#999] m-0 mt-[1px]">
                  {formatCurrency(item.unitPrice, order.currency)} × {item.quantity}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-[14px]">
        <span className="text-[10px] uppercase font-bold tracking-[.08em] text-[#777]">
          {order.items.length} item{order.items.length > 1 ? 's' : ''}
        </span>
        <span className="text-[15px] font-bold">{formatCurrency(order.total, order.currency)}</span>
      </div>
      {order.isPickup && (
        <div className="mt-[10px] pt-[10px] border-t border-line">
          <p className="m-0 text-[11px] font-bold text-ink">📦 Store pickup</p>
        </div>
      )}
      {!order.isPickup && order.address && (
        <details className="group mt-[10px] pt-[10px] border-t border-line">
          <summary className="flex items-center justify-between gap-[10px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-baseline gap-[6px] min-w-0">
              <span className="text-[12px] text-[#777] flex-shrink-0">Deliver to</span>
              <span className="text-[12px] font-semibold text-ink truncate">
                {order.address.name}
              </span>
            </span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="w-[14px] h-[14px] text-[#999] transition-transform duration-150 group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </summary>
          <div className="mt-[10px] text-[11px] text-[#333] leading-[1.7]">
            <p className="m-0">
              {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ''}
            </p>
            {order.address.landmark && <p className="m-0">{order.address.landmark}</p>}
            <p className="m-0">
              {order.address.city}, {order.address.state} — {order.address.pincode}
            </p>
            <p className="m-0 mt-[4px] text-[#555]">
              {order.address.mobileNo}
              {order.address.altMobileNo ? ` · ${order.address.altMobileNo}` : ''}
            </p>
          </div>
        </details>
      )}
      {order.shipment?.trackingId && (
        <div className="mt-[10px] pt-[10px] border-t border-line">
          <p className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] m-0 mb-[7px]">
            Tracking
          </p>
          <div className="flex items-center gap-[8px] flex-wrap">
            {order.shipment.courierPartner && (
              <span className="text-[9px] uppercase font-bold tracking-[.06em] bg-accent-soft text-accent px-[8px] py-[4px] rounded">
                {order.shipment.courierPartner}
              </span>
            )}
            <span className="text-[12px] font-mono font-medium text-ink break-all">
              {order.shipment.trackingId}
            </span>
            <button
              type="button"
              onClick={() => copyTracking(order.shipment.trackingId!)}
              aria-label="Copy tracking number"
              className="inline-flex items-center gap-[5px] text-[9px] uppercase font-bold tracking-[.06em] text-[#555] border border-line rounded px-[8px] py-[4px] transition-colors hover:border-ink hover:text-ink [&_svg]:w-[12px] [&_svg]:h-[12px]"
            >
              {copied ? (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { user, hydrated } = useCurrentUser();
  const { data: orders, isLoading: ordersLoading } = useMyOrders();

  // Outstanding = total of this user's orders still awaiting payment — both
  // unapproved (PENDING) and approved-on-credit (APPROVED_PAYMENT_PENDING).
  // Only surfaced when there's something owed.
  const pendingOrders = (orders ?? []).filter(
    (o) => o.status === ORDER_STATUS.PENDING || o.status === ORDER_STATUS.APPROVED_PAYMENT_PENDING,
  );
  const pendingTotal = pendingOrders.reduce((sum, o) => sum + o.total, 0);
  const pendingCurrency = pendingOrders[0]?.currency ?? 'INR';

  if (!hydrated)
    return (
      <>
        <SiteHeader />
        <main className="min-h-[80vh] grid place-items-center">
          <i className="w-[18px] h-[18px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />
        </main>
        <SiteFooter />
      </>
    );

  if (!user)
    return (
      <>
        <SiteHeader />
        <main className="min-h-[80vh] grid place-items-center text-center px-[7vw]">
          <h1 className="text-[clamp(32px,5vw,56px)] tracking-[-.06em] leading-[.95] m-0">
            Sign in to view your orders.
          </h1>
        </main>
        <SiteFooter />
      </>
    );

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-paper">
        {/* Page header */}
        <section className="pt-[56px] px-[5.25vw] pb-[40px] bg-[#111] text-white max-[700px]:py-[36px] max-[700px]:px-[15px]">
          <div className="max-w-[820px] mx-auto">
            <p className="text-[10px] tracking-[.16em] uppercase font-bold text-accent m-0 mb-[6px]">
              Order history
            </p>
            <h1 className="m-0 text-[clamp(30px,4vw,52px)] leading-[.9] tracking-[-.06em]">
              Your orders
            </h1>
            {orders && orders.length > 0 && (
              <p className="mt-[8px] text-[#999] text-[13px] m-0">
                {orders.length} order{orders.length > 1 ? 's' : ''} placed
              </p>
            )}
          </div>
        </section>

        {/* Orders list — same fade+lift entrance, but played on mount (not on
            scroll) so the list is always visible when the page loads. */}
        <motion.section
          className="max-w-[820px] mx-auto pt-[36px] px-[5.25vw] pb-[80px] max-[700px]:px-[15px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {ordersLoading && (
            <div className="flex items-center gap-[10px] text-[13px] text-[#666]">
              <i className="w-[14px] h-[14px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite] inline-block" />
              Loading orders…
            </div>
          )}
          {pendingTotal > 0 && (
            <div className="mb-[18px] border border-yellow-300 bg-yellow-50 p-[18px] max-[700px]:px-[15px]">
              <p className="text-[9px] uppercase font-bold tracking-[.08em] text-yellow-800 m-0 mb-[6px]">
                Payment pending
              </p>
              <p className="text-[22px] font-bold text-yellow-900 m-0 leading-none">
                {formatCurrency(pendingTotal, pendingCurrency)}
              </p>
              <p className="text-[11px] text-yellow-800 m-0 mt-[6px]">
                Outstanding across {pendingOrders.length} order
                {pendingOrders.length > 1 ? 's' : ''}.
              </p>
            </div>
          )}
          {orders && orders.length > 0 ? (
            <div className="grid gap-[14px]">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            !ordersLoading && (
              <div className="text-center py-[40px]">
                <p className="text-[15px] text-[#666] leading-[1.6] m-0 mb-[20px]">
                  You haven&apos;t placed any orders yet.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-[12px] px-[15px] py-[13px] bg-ink text-white rounded-[8px] no-underline text-[10px] uppercase font-bold tracking-[.07em]"
                >
                  Start shopping
                </Link>
              </div>
            )
          )}
        </motion.section>
      </main>
      <SiteFooter />
    </>
  );
}
