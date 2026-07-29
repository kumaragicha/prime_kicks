import Link from 'next/link';
import { Icon } from './icon';

export function SiteFooter() {
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
        <a
          className="text-[#111] bg-accent no-underline py-[14px] px-[17px] text-[10px] uppercase tracking-[.09em] font-bold flex items-center gap-[30px] [&_svg]:w-[15px]"
          href="mailto:hello@primekicks.in"
        >
          Contact us <Icon name="arrow" />
        </a>
      </section>
      <div className="grid grid-cols-[1fr_1fr_1.7fr] gap-[30px] pt-[39px] px-0 pb-[53px] max-[800px]:grid-cols-2 max-[800px]:py-[31px] max-[800px]:px-0 max-[800px]:gap-x-[16px] max-[800px]:gap-y-[28px]">
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
          <a
            className="text-white text-[12px] no-underline hover:underline"
            href="mailto:hello@primekicks.in"
          >
            Contact us
          </a>
          <a className="text-white text-[12px] no-underline hover:underline" href="#shipping">
            Shipping & returns
          </a>
          <a className="text-white text-[12px] no-underline hover:underline" href="#authenticity">
            Authenticity
          </a>
        </div>
        <div className="grid content-start gap-[11px] max-[800px]:col-[1/-1] max-[800px]:mt-[10px]">
          <p className="text-[10px] uppercase tracking-[.1em] font-bold text-[#aaa] m-0 mb-[5px]">
            Stay in the loop
          </p>
          <span className="text-[12px] text-[#bbb] leading-[1.5] max-w-[300px]">
            New drops, restocks, and stories — straight to your inbox.
          </span>
          <form
            className="flex border-b border-[#777] max-w-[315px] mt-[6px]"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-white py-[10px] px-0 text-[12px] focus:outline-none"
              type="email"
              placeholder="Email address"
              aria-label="Email address"
            />
            <button
              className="border-0 bg-transparent text-accent p-[6px] [&_svg]:w-[18px]"
              aria-label="Subscribe"
            >
              <Icon name="arrow" />
            </button>
          </form>
        </div>
      </div>
      <div className="pt-[19px] border-t border-[#444] flex justify-between gap-[20px] text-[#888] text-[9px] uppercase tracking-[.07em] max-[800px]:grid max-[800px]:gap-[17px] max-[800px]:leading-[1.4]">
        <span>© 2026 Prime Kicks. All rights reserved.</span>
        <div className="flex gap-[20px] max-[800px]:gap-[14px] max-[800px]:flex-wrap">
          <a
            className="text-white no-underline hover:underline"
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
          <a
            className="text-white no-underline hover:underline"
            href="https://facebook.com"
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
          <a
            className="text-white no-underline hover:underline"
            href="https://x.com"
            target="_blank"
            rel="noreferrer"
          >
            X / Twitter
          </a>
        </div>
      </div>
    </footer>
  );
}
