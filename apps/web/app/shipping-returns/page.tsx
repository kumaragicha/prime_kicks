'use client';

import { Announcement } from '@/components/announcement';
import { Icon } from '@/components/icon';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

const WHATSAPP_URL = 'https://api.whatsapp.com/send?phone=918866929090';

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.3.1-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.8.8-.8 2s.9 2.3 1 2.4c.1.2 1.7 2.7 4.2 3.7 1.6.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1 .1-1.2 0-.1-.2-.1-.4-.3Z" />
    </svg>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-[11px] text-[13.5px] leading-[1.6] text-[#555]">
      <span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}

const SHIPPING = [
  'Orders are dispatched within 1–2 business days of confirmation.',
  'Delivery typically takes 3–7 business days depending on your location.',
  'Free express shipping on orders over ₹10,000; a flat shipping fee applies below that and is shown at checkout.',
  'Pan-India, fully tracked delivery — your tracking link is shared as soon as the order ships.',
  'Please double-check your address and phone number; deliveries that fail due to incorrect details may attract a re-shipping charge.',
];

const RETURNS = [
  'Easy returns & exchanges within 7 days of receiving your order.',
  'Items must be unworn and unused, in original condition with the box, tags and all accessories intact.',
  'Once we receive and inspect the item, your exchange is shipped or your refund is processed.',
  'Worn, used, or damaged items — or those without original packaging — are not eligible.',
];

const STEPS = [
  { n: '01', t: 'Message us', d: 'Ping us on WhatsApp with your order number within 7 days of delivery.' },
  { n: '02', t: 'Pack it up', d: 'Repack the pair in its original box with tags and accessories.' },
  { n: '03', t: 'Ship & swap', d: 'Courier it back — once inspected, we ship your exchange or process the refund.' },
];

export default function ShippingReturnsPage() {
  return (
    <main>
      <Announcement />
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-[1180px] mx-auto px-[5.25vw] pt-[70px] pb-[42px] max-[800px]:pt-[46px] max-[800px]:px-[21px]">
        <p className="m-0 mb-[13px] text-[10px] font-bold uppercase tracking-[.18em] text-accent">
          Help
        </p>
        <h1 className="m-0 text-[clamp(46px,6.4vw,88px)] leading-[.84] tracking-[-.09em] max-[800px]:text-[52px]">
          Shipping &amp; <em className="font-[Georgia,serif] font-normal">returns.</em>
        </h1>
        <p className="mt-[24px] max-w-[560px] text-[15px] leading-[1.7] text-[#555]">
          Fast, tracked delivery across India and a simple 7-day return &amp; exchange window — so
          you can shop your next pair with total confidence.
        </p>
      </section>

      {/* Two cards */}
      <section className="max-w-[1180px] mx-auto px-[5.25vw] pb-[16px] grid grid-cols-2 gap-[26px] max-[800px]:grid-cols-1 max-[800px]:px-[21px]">
        <article className="rounded-[18px] border border-line bg-white p-[30px] max-[800px]:p-[24px]">
          <div className="mb-[18px] flex items-center gap-[12px]">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-accent-soft text-ink [&_svg]:w-[18px]">
              <Icon name="bag" />
            </span>
            <h2 className="m-0 text-[20px] tracking-[-.04em]">Shipping</h2>
          </div>
          <ul className="grid gap-[13px] list-none p-0 m-0">
            {SHIPPING.map((s) => (
              <Bullet key={s}>{s}</Bullet>
            ))}
          </ul>
        </article>

        <article className="rounded-[18px] border border-line bg-white p-[30px] max-[800px]:p-[24px]">
          <div className="mb-[18px] flex items-center gap-[12px]">
            <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-accent-soft text-ink [&_svg]:w-[18px]">
              <Icon name="arrow" />
            </span>
            <h2 className="m-0 text-[20px] tracking-[-.04em]">Returns &amp; exchange</h2>
          </div>
          <ul className="grid gap-[13px] list-none p-0 m-0">
            {RETURNS.map((s) => (
              <Bullet key={s}>{s}</Bullet>
            ))}
          </ul>
        </article>
      </section>

      {/* Courier-charge callout */}
      <section className="max-w-[1180px] mx-auto px-[5.25vw] py-[24px] max-[800px]:px-[21px]">
        <div className="flex items-start gap-[14px] rounded-[14px] border border-accent/40 bg-accent-soft px-[22px] py-[18px]">
          <span className="mt-[1px] grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full bg-accent text-white text-[13px] font-bold">
            ₹
          </span>
          <p className="m-0 text-[13.5px] leading-[1.6] text-[#5a4a2c]">
            <strong className="text-ink">Please note:</strong> return &amp; exchange courier charges
            are to be borne by the customer. The original shipping fee (if any) is non-refundable.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-[1180px] mx-auto px-[5.25vw] pt-[34px] pb-[80px] max-[800px]:px-[21px] max-[800px]:pb-[60px]">
        <h2 className="m-0 mb-[26px] text-[clamp(26px,3vw,38px)] tracking-[-.06em]">
          How a return <em className="font-[Georgia,serif] font-normal">works.</em>
        </h2>
        <div className="grid grid-cols-3 gap-[22px] max-[800px]:grid-cols-1">
          {STEPS.map((step) => (
            <div key={step.n} className="border-t-2 border-ink pt-[16px]">
              <p className="m-0 text-[12px] font-bold tracking-[.1em] text-accent">{step.n}</p>
              <h3 className="mt-[8px] mb-[7px] text-[17px] tracking-[-.03em]">{step.t}</h3>
              <p className="m-0 text-[13px] leading-[1.6] text-[#666]">{step.d}</p>
            </div>
          ))}
        </div>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-[34px] inline-flex items-center gap-[12px] rounded-[10px] bg-[#25D366] text-white no-underline py-[14px] px-[22px] text-[12px] font-bold uppercase tracking-[.08em] transition-transform duration-200 hover:translate-x-[3px] [&_svg]:w-[19px] [&_svg]:h-[19px] max-[520px]:w-full max-[520px]:justify-center"
        >
          <WhatsAppIcon /> Start a return on WhatsApp
        </a>
      </section>

      <SiteFooter />
    </main>
  );
}
