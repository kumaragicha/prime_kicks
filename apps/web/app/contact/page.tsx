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

const STATS = [
  { value: 'Since 2014', label: 'Trusted sneaker source' },
  { value: '100% Authentic', label: 'Every pair hand-checked' },
  { value: 'Pan-India', label: 'Fast, tracked delivery' },
];

export default function ContactPage() {
  return (
    <main>
      <Announcement />
      <SiteHeader />

      <section className="max-w-[1180px] mx-auto px-[5.25vw] py-[48px] grid gap-[48px] items-center lg:grid-cols-[1.05fr_1fr] lg:min-h-[calc(100vh-108px)] max-[800px]:px-[21px] max-[800px]:py-[38px] max-[800px]:gap-[32px]">
        {/* Left — brand story + stats */}
        <div>
          <p className="m-0 mb-[13px] text-[10px] font-bold uppercase tracking-[.18em] text-accent">
            Get in touch
          </p>
          <h1 className="m-0 text-[clamp(44px,5.4vw,78px)] leading-[.84] tracking-[-.09em] max-[800px]:text-[54px]">
            Let&apos;s talk <em className="font-[Georgia,serif] font-normal">kicks.</em>
          </h1>
          <p className="mt-[22px] max-w-[500px] text-[15px] leading-[1.7] text-[#555]">
            Prime Kicks has dealt in premium sneakers since 2014 — curating authentic, hand-inspected
            pairs for collectors and everyday wearers across India.
          </p>

          <div className="mt-[34px] grid grid-cols-3 gap-[18px] max-w-[520px] max-[520px]:grid-cols-1">
            {STATS.map((s) => (
              <div key={s.value} className="border-t border-line pt-[13px]">
                <p className="m-0 text-[16px] font-bold tracking-[-.03em]">{s.value}</p>
                <p className="m-0 mt-[4px] text-[11px] uppercase tracking-[.06em] text-[#8a8a8a] leading-[1.4]">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — elegant WhatsApp card */}
        <div className="relative overflow-hidden rounded-[20px] bg-ink text-white p-[38px] max-[800px]:p-[28px]">
          <div className="pointer-events-none absolute -top-[80px] -right-[80px] h-[240px] w-[240px] rounded-full bg-accent/20 blur-[70px]" />

          <p className="relative m-0 text-[10px] font-bold uppercase tracking-[.16em] text-accent">
            Fastest way to reach us
          </p>
          <h2 className="relative mt-[12px] text-[clamp(28px,3.2vw,40px)] leading-[.94] tracking-[-.05em]">
            Slide into our
            <br />
            <em className="font-[Georgia,serif] font-normal">WhatsApp.</em>
          </h2>
          <p className="relative mt-[16px] text-[13px] leading-[1.65] text-[#bdbcb9] max-w-[360px]">
            Sizing help, restock ETAs, order tracking, or a quick legit-check before you buy — drop
            us a message and a real sneakerhead replies. Usually within a few hours, 10am–8pm IST.
          </p>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="relative mt-[24px] inline-flex items-center justify-center gap-[12px] rounded-[10px] bg-[#25D366] text-white no-underline py-[15px] px-[22px] text-[12px] font-bold uppercase tracking-[.08em] transition-transform duration-200 hover:translate-x-[3px] [&_svg]:w-[20px] [&_svg]:h-[20px] max-[520px]:w-full"
          >
            <WhatsAppIcon /> Contact us on WhatsApp
          </a>

          <div className="relative mt-[24px] pt-[22px] border-t border-white/12">
            <a
              href="mailto:theprimekicksbookings@gmail.com"
              className="inline-flex items-center gap-[10px] text-[13px] text-white no-underline hover:text-accent transition-colors [&_svg]:w-[15px]"
            >
              <Icon name="arrow" /> theprimekicksbookings@gmail.com
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
