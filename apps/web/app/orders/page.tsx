'use client';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { useMyOrders } from '@/lib/hooks';
import { ORDER_STATUS, type Order } from '@prime-kicks/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type User = { name: string; email: string };

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED_PAYMENT_RECEIVED: 'Approved · Payment Received',
  APPROVED_PAYMENT_PENDING: 'Approved · Payment Pending',
  REJECTED: 'Rejected',
};

function OrderCard({ order }: { order: Order }) {
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
      <div className="flex gap-[12px] overflow-x-auto pb-[8px]">
        {order.items.map((item) => (
          <div key={item.id} className="flex-shrink-0 w-[80px]">
            {item.product.photoUrls[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.product.photoUrls[0]}
                alt={item.title}
                className="w-full h-[80px] object-cover rounded"
              />
            )}
            <p className="text-[9px] mt-[4px] text-[#555] truncate">{item.title}</p>
            <p className="text-[9px] text-[#777]">
              {item.sizeLabel ?? ''} × {item.quantity}
            </p>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-[12px] pt-[12px] border-t border-line">
        <span className="text-[10px] text-[#555]">
          {order.items.length} item{order.items.length > 1 ? 's' : ''}
        </span>
        <span className="text-[13px] font-bold">
          ₹{order.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const { data: orders, isLoading: ordersLoading } = useMyOrders();

  useEffect(() => {
    const saved = window.localStorage.getItem('prime-kicks-user');
    if (saved) setUser(JSON.parse(saved) as User);
    setHydrated(true);
  }, []);

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

        {/* Orders list */}
        <div className="max-w-[820px] mx-auto pt-[36px] px-[5.25vw] pb-[80px] max-[700px]:px-[15px]">
          {ordersLoading && (
            <div className="flex items-center gap-[10px] text-[13px] text-[#666]">
              <i className="w-[14px] h-[14px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite] inline-block" />
              Loading orders…
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
                  className="inline-flex items-center gap-[12px] px-[15px] py-[13px] bg-ink text-white no-underline text-[10px] uppercase font-bold tracking-[.07em]"
                >
                  Start shopping
                </Link>
              </div>
            )
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
