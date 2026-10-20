'use client';

import { DELIVERY_WINDOW, expectedDeliveryDate, formatDeliveryDate } from '@/lib/delivery';
import type { Order } from '@prime-kicks/types';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Full details of a customer order — delivery / tracking, items, payment
 * summary and address. Shared by the order-confirmation screen and the
 * My orders → order details screen so both always show the same information.
 */
export function OrderDetails({ order }: { order: Order }) {
  const [copied, setCopied] = useState(false);
  const isCod = order.paymentMethod === 'COD';
  const codDue = isCod && order.paymentStatus !== 'RECEIVED';
  const deliveryBy = formatDeliveryDate(expectedDeliveryDate(5, new Date(order.createdAt)));
  const tracking = order.shipment?.trackingId ?? null;

  function copyTracking(value: string) {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="grid gap-[16px] text-left">
      {/* Delivery / tracking */}
      {order.isPickup ? (
        <div className="rounded-[14px] border border-ink bg-[#faf8f4] p-[16px] text-[13px] font-bold">
          📦 Store pickup
        </div>
      ) : (
        <div className="flex items-start gap-[12px] rounded-[14px] border border-ink bg-[#faf8f4] p-[16px] [&>svg]:h-[20px] [&>svg]:w-[20px] [&>svg]:shrink-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
            <circle cx="7" cy="17.5" r="1.8" />
            <circle cx="17" cy="17.5" r="1.8" />
          </svg>
          <div className="grid min-w-0 gap-[2px] text-[12.5px] text-[#555]">
            {tracking ? (
              <>
                <p className="m-0 text-[14px] font-bold text-ink">
                  Shipped
                  {order.shipment.courierPartner ? ` via ${order.shipment.courierPartner}` : ''}
                </p>
                <div className="mt-[4px] flex flex-wrap items-center gap-[8px]">
                  <span className="break-all font-mono text-[12.5px] font-medium text-ink">
                    {tracking}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyTracking(tracking)}
                    aria-label="Copy tracking number"
                    className="rounded border border-line bg-white px-[8px] py-[4px] text-[9px] font-bold uppercase tracking-[.06em] text-[#555] transition-colors hover:border-ink hover:text-ink"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="m-0 text-[14px] font-bold text-ink">Expected by {deliveryBy}</p>
                <p className="m-0">Standard delivery (FREE) · {DELIVERY_WINDOW}</p>
                <p className="m-0">We&apos;ll share tracking details once your order ships.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="rounded-[14px] border border-line bg-white p-[16px]">
        <p className="m-0 mb-[12px] text-[10px] font-bold uppercase tracking-[.16em]">
          Items ({order.items.reduce((n, i) => n + i.quantity, 0)})
        </p>
        <div className="grid gap-[12px]">
          {order.items.map((item) => (
            <Link
              key={item.id}
              href={`/products/${item.productId}`}
              className="flex items-center gap-[12px] text-ink no-underline"
            >
              <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[8px] bg-[#e9e7e1]">
                {item.product.photoUrls[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.product.photoUrls[0]}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[13px] font-bold">{item.title}</p>
                <p className="m-0 text-[11px] text-[#777]">
                  {item.sizeLabel ? `Size ${item.sizeLabel} · ` : ''}Qty {item.quantity}
                </p>
              </div>
              <span className="text-[13px] font-bold">
                {formatCurrency(item.unitPrice * item.quantity)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Payment summary */}
      <div className="grid gap-[10px] rounded-[14px] border border-line bg-white p-[16px] text-[13px] text-[#555]">
        <p className="m-0 mb-[2px] text-[10px] font-bold uppercase tracking-[.16em] text-ink">
          Payment summary
        </p>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="text-ink">{formatCurrency(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-[#4b7d4b]">
            <span>Coupon{order.couponCode ? ` (${order.couponCode})` : ''}</span>
            <span>−{formatCurrency(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Delivery</span>
          <span className="font-bold text-[#4b7d4b]">FREE</span>
        </div>
        <div className="flex justify-between border-t border-line pt-[10px] text-[14px] font-bold text-ink">
          <span>Order total</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
        {order.paymentMethod && (
          <>
            <div className="flex justify-between">
              <span>Payment method</span>
              <span className="font-bold text-ink">
                {isCod ? 'Cash on delivery' : 'Paid online'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{isCod ? 'Advance paid online' : 'Paid online'}</span>
              <span className="text-ink">{formatCurrency(order.advancePaid || order.total)}</span>
            </div>
            {isCod &&
              (codDue ? (
                <div className="flex justify-between font-bold text-[#7a5a1e]">
                  <span>To pay on delivery (cash)</span>
                  <span>{formatCurrency(order.codAmount)}</span>
                </div>
              ) : (
                <div className="flex justify-between font-bold text-[#4b7d4b]">
                  <span>Paid on delivery</span>
                  <span>{formatCurrency(order.codAmount)}</span>
                </div>
              ))}
          </>
        )}
      </div>

      {/* Address */}
      {order.address && (
        <div className="rounded-[14px] border border-line bg-white p-[16px] text-[12.5px] leading-[1.6] text-[#555]">
          <p className="m-0 mb-[8px] text-[10px] font-bold uppercase tracking-[.16em] text-ink">
            Delivering to
          </p>
          <p className="m-0 text-[14px] font-bold text-ink">{order.address.name}</p>
          <p className="m-0">{order.address.line1}</p>
          {order.address.line2 && <p className="m-0">{order.address.line2}</p>}
          {order.address.landmark && <p className="m-0">{order.address.landmark}</p>}
          <p className="m-0">
            {order.address.city}, {order.address.state} - {order.address.pincode}
          </p>
          <p className="m-0 mt-[4px]">
            Phone: {order.address.mobileNo}
            {order.address.altMobileNo ? ` · ${order.address.altMobileNo}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

/** Customer-friendly status for a web order, with badge colours. */
export function customerOrderStatus(order: Order): { label: string; className: string } {
  if (order.status === 'REJECTED')
    return { label: 'Cancelled', className: 'bg-red-100 text-red-800' };
  if (order.shipment?.trackingId)
    return { label: 'Shipped', className: 'bg-blue-100 text-blue-800' };
  if (order.paymentMethod === 'COD' && order.paymentStatus !== 'RECEIVED')
    return { label: 'Pay on delivery', className: 'bg-amber-100 text-amber-800' };
  if (order.status === 'APPROVED_PAYMENT_RECEIVED')
    return { label: 'Confirmed', className: 'bg-green-100 text-green-800' };
  return { label: 'Processing', className: 'bg-yellow-100 text-yellow-800' };
}
