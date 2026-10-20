'use client';

import { Icon } from '@/components/icon';
import { OrderDetails } from '@/components/order-details';
import { SuccessAnimation } from '@/components/order-success';
import { api } from '@/lib/api';
import type { Order } from '@prime-kicks/types';
import { formatCurrency, formatOrderId } from '@prime-kicks/utils';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const WHATSAPP_HELP_URL = 'https://api.whatsapp.com/send?phone=918866929090';

/**
 * Customer-site order confirmation: payment is already done (online in full or
 * the COD advance), so this shows a success message and the order details —
 * items, amounts, payment, delivery address and expected delivery date. The
 * reseller site keeps its own WhatsApp-to-pay screen (OrderSuccess).
 */
export function CustomerOrderSuccess({ orderNumber }: { orderNumber: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    api
      .getMyOrders()
      .then((orders) => {
        if (cancelled) return;
        const found = orders.find((o) => o.orderNumber === orderNumber) ?? null;
        setOrder(found);
        setStatus(found ? 'ready' : 'missing');
      })
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  const isCod = order?.paymentMethod === 'COD';

  return (
    <section className="mx-auto max-w-[640px] px-[5.25vw] pb-[100px] pt-[70px] max-[760px]:px-[15px] max-[760px]:pt-[44px]">
      <div className="text-center">
        <SuccessAnimation />

        <div className="animate-[rise_0.45s_0.35s_both] motion-reduce:animate-none">
          <p className="m-0 mb-[10px] text-[10px] font-bold uppercase tracking-[.16em] text-accent">
            {isCod ? 'Advance received' : 'Payment successful'}
          </p>
          <h1 className="m-0 mb-[14px] text-[clamp(38px,5.5vw,58px)] leading-[.82] tracking-[-.09em]">
            Order <em className="font-[Georgia,serif] font-normal">confirmed.</em>
          </h1>
          <p className="m-0 text-[13px] text-[#666]">
            Thank you! Your order <b className="text-ink">{formatOrderId(orderNumber)}</b> is
            confirmed and we&apos;re getting it ready.
          </p>

          {order && (
            <p
              className={`mx-auto mt-[16px] max-w-[440px] rounded-[10px] px-[14px] py-[11px] text-[12.5px] font-bold leading-[1.5] ${
                isCod ? 'bg-[#fbf3e3] text-[#7a5a1e]' : 'bg-[#f1f7f1] text-[#3f6b3f]'
              }`}
            >
              {isCod ? (
                <>
                  {formatCurrency(order.advancePaid)} advance paid · Please keep{' '}
                  {formatCurrency(order.codAmount)} ready to pay in cash on delivery.
                </>
              ) : (
                <>
                  {formatCurrency(order.advancePaid || order.total)} paid online. Nothing more to
                  pay.
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Order details */}
      {status === 'loading' && (
        <p className="mt-[34px] text-center text-[10px] uppercase tracking-[.1em] text-[#999]">
          Loading your order details…
        </p>
      )}

      {order && (
        <div className="mt-[34px] animate-[rise_0.45s_0.5s_both] motion-reduce:animate-none">
          <OrderDetails order={order} />
        </div>
      )}

      {status === 'missing' && (
        <p className="mt-[28px] text-center text-[12.5px] text-[#666]">
          You can see the full details of this order under <b className="text-ink">My orders</b>.
        </p>
      )}

      {/* Actions */}
      <div className="mt-[28px] flex flex-wrap items-center justify-center gap-[10px]">
        <Link
          className="inline-flex items-center gap-[12px] rounded-[8px] bg-ink px-[20px] py-[13px] text-[10px] font-bold uppercase tracking-[.08em] text-white no-underline transition-transform duration-200 hover:-translate-y-[2px] [&_svg]:w-[14px]"
          href="/orders"
        >
          View my orders <Icon name="arrow" />
        </Link>
        <Link
          className="inline-flex items-center rounded-[8px] border border-ink px-[20px] py-[13px] text-[10px] font-bold uppercase tracking-[.08em] text-ink no-underline transition-colors duration-200 hover:bg-[#f3f1ec]"
          href="/"
        >
          Continue shopping
        </Link>
      </div>
      <p className="mt-[16px] text-center text-[11.5px] text-[#888]">
        Questions about your order?{' '}
        <a
          href={WHATSAPP_HELP_URL}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-ink underline underline-offset-2"
        >
          Chat with us on WhatsApp
        </a>
      </p>
    </section>
  );
}
