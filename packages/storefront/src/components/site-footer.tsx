import Link from 'next/link';
import { Icon } from './icon';

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/CJg0UBTOtJI8yZ41qoSsQq';
const INSTAGRAM_URL = 'https://www.instagram.com/primekicks_india';

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.3.1-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.8.8-.8 2s.9 2.3 1 2.4c.1.2 1.7 2.7 4.2 3.7 1.6.6 2.1.7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1 .1-1.2 0-.1-.2-.1-.4-.3Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BulkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 8.5V15l9 4.5 9-4.5V8.5" />
      <path d="M12 13v6.5" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer
      className="bg-[#111] mt-[24px] text-white pt-[72px] px-[5.25vw] pb-[21px] max-[800px]:pt-[48px] max-[800px]:px-[21px] max-[800px]:pb-[19px]"
      id="contact"
    >
      <section className="pb-[65px] border-b border-[#444] flex flex-col items-start max-[800px]:pb-[47px]">
        <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold text-accent">
          Can&apos;t find your pair?
        </p>
        <h2 className="text-[clamp(43px,6vw,86px)] leading-[1] tracking-[-.09em] m-0 mb-[29px] max-[800px]:text-[49px]">
          Tell us —
          <br />
          <em className="font-[Georgia,serif] font-normal">{`we'll find it.`}</em>
        </h2>
        <Link
          className="text-[#111] rounded-[8px] bg-accent no-underline py-[14px] px-[17px] text-[10px] uppercase tracking-[.09em] font-bold flex items-center gap-[12px] [&_svg]:w-[15px]"
          href="/contact"
        >
          Contact us <Icon name="arrow" strokeWidth={2.6} />
        </Link>
      </section>

      {/* Bulk / reseller orders — WhatsApp-branded band, deliberately distinct
          from the gold CTAs so it reads as its own offer. */}
      {/* <section className="mt-[40px] rounded-[16px] border border-[#2a2a2a] bg-[linear-gradient(120deg,#1b1b1b,#141414)] p-[26px] flex flex-col gap-[20px] sm:flex-row sm:items-center sm:justify-between max-[800px]:mt-[30px] max-[800px]:p-[22px]">
        <div className="flex items-start gap-[16px]">
          <span className="grid place-items-center w-[46px] h-[46px] rounded-[12px] bg-[#25D366]/15 text-[#25D366] shrink-0 [&_svg]:w-[23px] [&_svg]:h-[23px]">
            <BulkIcon />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-[.16em] font-bold text-[#25D366] m-0 mb-[6px]">
              Bulk &amp; reseller orders
            </p>
            <h3 className="text-[21px] tracking-[-.03em] font-bold m-0 mb-[6px] max-[800px]:text-[18px]">
              Ordering in volume?
            </h3>
            <p className="text-[12px] text-[#bbb] leading-[1.55] max-w-[430px] m-0">
              Get wholesale pricing, guaranteed stock, and priority dispatch. Message us on WhatsApp
              and our team will set up your bulk order.
            </p>
          </div>
        </div>
        <a
          href={WHATSAPP_GROUP_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 self-start sm:self-auto inline-flex items-center justify-center gap-[10px] rounded-[10px] bg-[#25D366] text-[#0b141a] no-underline py-[14px] px-[22px] text-[11px] font-bold uppercase tracking-[.08em] transition-[transform,background-color] duration-200 hover:-translate-y-[2px] hover:bg-[#1ebe57] [&_svg]:w-[18px] [&_svg]:h-[18px]"
        >
          <WhatsAppIcon /> Chat on WhatsApp
        </a>
      </section> */}

      <div className="grid grid-cols-[1fr_1fr_1.7fr] gap-[30px] pt-[39px] px-0 pb-[53px] max-[800px]:grid-cols-2 max-[800px]:py-[31px] max-[800px]:px-0 max-[800px]:gap-x-[16px] max-[800px]:gap-y-[28px]">
        <div className="grid content-start gap-[11px]">
          <p className="text-[10px] uppercase tracking-[.1em] font-bold text-[#aaa] m-0 mb-[5px]">
            Prime Kicks
          </p>
          <Link className="text-white text-[12px] no-underline hover:underline" href="/#new">
            New arrivals
          </Link>
          <Link className="text-white text-[12px] no-underline hover:underline" href="/search">
            Shop all
          </Link>
          <Link className="text-white text-[12px] no-underline hover:underline" href="/#brands">
            Brands
          </Link>
        </div>
        <div className="grid content-start gap-[11px]">
          <p className="text-[10px] uppercase tracking-[.1em] font-bold text-[#aaa] m-0 mb-[5px]">
            Help
          </p>
          <Link className="text-white text-[12px] no-underline hover:underline" href="/contact">
            Contact us
          </Link>
          <Link
            className="text-white text-[12px] no-underline hover:underline"
            href="/shipping-returns"
          >
            Shipping & returns
          </Link>
        </div>
        <div className="grid content-start gap-[11px] max-[800px]:col-[1/-1] max-[800px]:mt-[10px]">
          <p className="text-[10px] uppercase tracking-[.1em] font-bold text-[#aaa] m-0 mb-[5px]">
            Join the community
          </p>
          <span className="text-[12px] text-[#bbb] leading-[1.5] max-w-[300px]">
            New drops, restocks, and early access — first on our WhatsApp group and Instagram.
          </span>
          <div className="mt-[8px] flex flex-wrap gap-[10px]">
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-[9px] rounded-[8px] bg-accent text-[#111] no-underline py-[11px] px-[15px] text-[11px] font-bold uppercase tracking-[.08em] transition-colors duration-200 hover:bg-[#c9a869] [&_svg]:w-[16px] [&_svg]:h-[16px]"
            >
              <WhatsAppIcon /> Join group
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-[9px] rounded-[8px] border border-[#555] text-white no-underline py-[11px] px-[15px] text-[11px] font-bold uppercase tracking-[.08em] transition-colors duration-200 hover:border-white hover:bg-white/5 [&_svg]:w-[16px] [&_svg]:h-[16px]"
            >
              <InstagramIcon /> Follow us
            </a>
          </div>
        </div>
      </div>
      <div className="pt-[19px] border-t border-[#444] text-[#888] text-[9px] uppercase tracking-[.07em]">
        <span>© 2026 Prime Kicks. All rights reserved.</span>
      </div>
    </footer>
  );
}
