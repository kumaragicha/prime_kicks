'use client';

import { Announcement } from '@/components/announcement';
import { FilterDrawer } from '@/components/filter-drawer';
import { Icon } from '@/components/icon';
import { LoginModal } from '@/components/login-modal';
import { ProductCard, type StoreProduct } from '@/components/product-card';
import { SiteHeader } from '@/components/site-header';
import { api } from '@/lib/api';
import { notifyStore, useAuthCart, useInfiniteProducts } from '@/lib/hooks';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function HomePage() {
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } =
    useInfiniteProducts();
  const { user, refresh } = useAuthCart();
  const [toast, setToast] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{ product: StoreProduct; variantId: string } | null>(
    null,
  );
  const loader = useRef<HTMLDivElement>(null);
  const products = useMemo<StoreProduct[]>(
    () =>
      data?.pages.flatMap((page) =>
        page.data.map((product) => {
          const sizes = product.variants
            .filter((variant) => variant.stock > 0)
            .map((variant) => ({ id: variant.id, label: variant.size.label }))
            .slice(0, 4);
          return {
            id: product.id,
            name: product.name,
            brand: product.brand,
            price: product.customerPrice,
            currency: product.currency,
            image: product.photoUrls[0] ?? '',
            color: product.totalStock > 0 ? `${product.totalStock} in stock` : 'Sold out',
            sizes,
          };
        }),
      ) ?? [],
    [data],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '300px' },
    );
    if (loader.current) observer.observe(loader.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (window.localStorage.getItem('prime-kicks-open-login') === 'true') {
      window.localStorage.removeItem('prime-kicks-open-login');
      setLoginOpen(true);
    }
  }, []);

  async function addToCart(product: StoreProduct, variantId: string) {
    if (!user) {
      setPendingAdd({ product, variantId });
      setLoginOpen(true);
      return;
    }
    try {
      await api.addToCart(product.id, variantId);
      notifyStore();
      setToast(`${product.name} added to your bag`);
    } catch {
      setToast('We couldn’t add this pair. Please try again.');
    }
    window.setTimeout(() => setToast(''), 2200);
  }

  return (
    <main>
      <Announcement />
      <SiteHeader />

      <section
        className="relative min-h-[492px] py-[82px] px-[7vw] overflow-hidden bg-[#d9d7d0] bg-[url('https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1800&q=90')] bg-[center_42%] bg-cover text-white isolate after:content-[''] after:absolute after:inset-0 after:bg-[linear-gradient(90deg,rgba(0,0,0,0.68),rgba(0,0,0,0.12)_72%)] after:-z-[1] max-[800px]:min-h-[370px] max-[800px]:py-[58px] max-[800px]:px-[21px] max-[800px]:bg-[58%_center]"
        id="top"
      >
        <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
          The summer edit — 2026
        </p>
        <h1 className="text-[clamp(48px,7.6vw,110px)] tracking-[-.09em] leading-[.82] m-0 mb-[33px] font-[900] max-[800px]:text-[57px]">
          Step into
          <br />
          <em className="font-[Georgia,serif] font-normal tracking-[-.1em]">what&apos;s next.</em>
        </h1>
        <a
          className="text-white bg-ink border border-[rgba(255,255,255,0.3)] no-underline uppercase text-[11px] font-bold tracking-[.09em] py-[15px] px-[17px] inline-flex gap-[22px] items-center transition-[transform,background] duration-200 hover:translate-x-[5px] hover:bg-[#31302d] [&_svg]:w-[16px] [&_svg]:h-[16px]"
          href="#shop"
        >
          Shop new arrivals <Icon name="arrow" />
        </a>
        <div className="hero-orb" />
      </section>

      <section
        className="pt-[74px] px-[5.25vw] pb-[42px] max-[800px]:pt-[43px] max-[800px]:px-[15px] max-[800px]:pb-[20px]"
        id="shop"
      >
        <div className="flex items-end justify-between mb-[27px]">
          <div>
            <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
              Curated for you
            </p>
            <h2 className="text-[38px] tracking-[-.07em] m-0 leading-[.9] max-[800px]:text-[31px]">
              Fresh drops
            </h2>
          </div>
          <button className="border border-ink bg-transparent uppercase text-[10px] tracking-[.1em] font-bold py-[10px] px-[12px]">
            Filter <span className="bg-ink text-white py-[2px] px-[4px] ml-[5px]">12</span>
          </button>
        </div>
        <div
          className="grid grid-cols-4 gap-x-[16px] gap-y-[27px] max-[800px]:grid-cols-2 max-[800px]:gap-x-[10px] max-[800px]:gap-y-[28px] min-[801px]:max-[1100px]:grid-cols-3"
          id="new"
        >
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addToCart}
              priority={index < 4}
            />
          ))}
          {isLoading && Array.from({ length: 8 }, (_, index) => <ProductSkeleton key={index} />)}
        </div>
        {isLoading && (
          <div className="h-[130px] flex items-center justify-center gap-[10px] text-[10px] tracking-[.1em] uppercase text-[#666] max-[800px]:h-[100px]">
            <i className="w-[15px] h-[15px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
            Loading fresh drops
          </div>
        )}
        {isError && (
          <div className="text-center text-[13px] text-[#666] pt-[40px] px-0 pb-[70px]">
            <p>We couldn’t load the catalogue. Check that the product API is running.</p>
            <button
              className="border-0 bg-ink text-white py-[11px] px-[14px] mt-[6px] text-[10px] font-bold uppercase tracking-[.08em] inline-flex items-center gap-[12px] [&_svg]:w-[13px]"
              onClick={() => refetch()}
            >
              Try again <Icon name="arrow" />
            </button>
          </div>
        )}
        {!isLoading && !isError && products.length === 0 && (
          <p className="text-center text-[13px] text-[#666] pt-[40px] px-0 pb-[70px]">
            No products are available right now.
          </p>
        )}
        {!isLoading && !isError && products.length > 0 && (
          <div
            className="h-[130px] flex items-center justify-center gap-[10px] text-[10px] tracking-[.1em] uppercase text-[#666] max-[800px]:h-[100px]"
            ref={loader}
          >
            {hasNextPage ? (
              <>
                {isFetchingNextPage && (
                  <i className="w-[15px] h-[15px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />
                )}
                {isFetchingNextPage ? 'Loading more kicks' : 'Scroll for more drops'}
              </>
            ) : (
              'You’re all caught up.'
            )}
          </div>
        )}
      </section>
      <footer
        className="bg-[#111] text-white pt-[72px] px-[5.25vw] pb-[21px] max-[800px]:pt-[48px] max-[800px]:px-[21px] max-[800px]:pb-[19px]"
        id="contact"
      >
        <section className="pb-[65px] border-b border-[#444] flex flex-col items-start max-[800px]:pb-[47px]">
          <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold text-accent">
            Need a hand?
          </p>
          <h2 className="text-[clamp(43px,6vw,86px)] leading-[.82] tracking-[-.09em] m-0 mb-[29px] max-[800px]:text-[49px]">
            Let&apos;s find your
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
            <a className="text-white text-[12px] no-underline hover:underline" href="#shop">
              New arrivals
            </a>
            <a className="text-white text-[12px] no-underline hover:underline" href="#shop">
              Shop all
            </a>
            <a className="text-white text-[12px] no-underline hover:underline" href="#brands">
              Brands
            </a>
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
              Shipping &amp; returns
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
      {toast && (
        <div className="fixed z-30 left-1/2 bottom-[23px] -translate-x-1/2 bg-[#111] text-white py-[13px] px-[17px] text-[11px] flex items-center gap-[8px] shadow-[0_8px_25px_#0003] animate-[toast_0.25s_ease-out] [&_svg]:w-[16px] max-[800px]:w-max max-[800px]:max-w-[calc(100%-30px)]">
          <Icon name="bag" /> {toast}
        </div>
      )}
      <FilterDrawer />
      {loginOpen && (
        <LoginModal
          onClose={() => {
            setLoginOpen(false);
            setPendingAdd(null);
          }}
          onSuccess={async () => {
            setLoginOpen(false);
            if (pendingAdd) {
              try {
                await api.addToCart(pendingAdd.product.id, pendingAdd.variantId);
                setToast(`${pendingAdd.product.name} added to your bag`);
              } catch {
                setToast('We couldn’t add this pair. Please try again.');
              }
              setPendingAdd(null);
            } else setToast('Welcome back.');
            await refresh();
            notifyStore();
            window.setTimeout(() => setToast(''), 2200);
          }}
        />
      )}
    </main>
  );
}

function ProductSkeleton() {
  return (
    <div className="min-w-0" aria-hidden="true">
      <div className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] aspect-[1/1.05]" />
      <p className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] w-[55%] h-[11px] mt-[14px] mx-0 mb-0" />
      <p className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] w-[82%] h-[11px] mt-[8px] mx-0 mb-0" />
      <span className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] block w-[45%] h-[10px] mt-[10px]" />
      <section className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] grid grid-cols-2 gap-[5px] mt-[13px]">
        <i className="h-[37px]" />
        <i className="h-[37px]" />
      </section>
    </div>
  );
}

