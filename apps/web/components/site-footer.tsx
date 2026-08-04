'use client';

import { useAuthCart } from '@/lib/hooks';
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

export function SiteFooter() {
  const { user } = useAuthCart();
  // The WhatsApp community group is a customer channel — hidden for resellers.
  const showCommunity = user?.role !== 'RESELLER';

  return (
    <footer
      className="bg-[#111] text-white pt-[72px] px-[5.25vw] pb-[21px] max-[800px]:pt-[48px] max-[800px]:px-[21px] max-[800px]:pb-[19px]"
      id="contact"
    >
      <section className="pb-[65px] border-b border-[#444] flex flex-col items-start max-[800px]:pb-[47px]">
        <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold text-accent">
          Need a hand?
        </p>
        <h2 className="text-[clamp(43px,6vw,86px)] leading-[.82] tracking-[-.09em] m-0 mb-[29px] max-[800px]:text-[49px]">
          Find your
          <br />
          <em className="font-[Georgia,serif] font-normal">next pair.</em>
        </h2>
        <Link
          className="text-[#111] bg-accent no-underline py-[14px] px-[17px] text-[10px] uppercase tracking-[.09em] font-bold flex items-center gap-[30px] [&_svg]:w-[15px]"
          href="/contact"
        >
          Contact us <Icon name="arrow" />
        </Link>
      </section>
      <div
        className={`grid ${
          showCommunity ? 'grid-cols-[1fr_1fr_1.7fr]' : 'grid-cols-[1fr_1fr]'
        } gap-[30px] pt-[39px] px-0 pb-[53px] max-[800px]:grid-cols-2 max-[800px]:py-[31px] max-[800px]:px-0 max-[800px]:gap-x-[16px] max-[800px]:gap-y-[28px]`}
      >
        <div className="grid content-start gap-[11px]">
          <p className="text-[10px] uppercase tracking-[.1em] font-bold text-[#aaa] m-0 mb-[5px]">
            Prime Kicks
          </p>
          <Link className="text-white text-[12px] no-underline hover:underline" href="/#new">
            New arrivals
          </Link>
          <Link className="text-white text-[12px] no-underline hover:underline" href="/#shop">
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
        {showCommunity && (
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
        )}
      </div>
      <div className="pt-[19px] border-t border-[#444] text-[#888] text-[9px] uppercase tracking-[.07em]">
        <span>© 2026 Prime Kicks. All rights reserved.</span>
      </div>
    </footer>
  );
}
