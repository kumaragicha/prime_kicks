'use client';

import { Announcement } from '@/components/announcement';
import { FilterDrawer } from '@/components/filter-drawer';
import { Icon } from '@/components/icon';
import { LoginModal } from '@/components/login-modal';
import { ProductCard, type StoreProduct } from '@/components/product-card';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Toast } from '@/components/toast';
import { ApiError, api } from '@/lib/api';
import { notifyStore, useAuthCart, useInfiniteProducts } from '@/lib/hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function HomePage() {
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } =
    useInfiniteProducts();
  const { user, refresh } = useAuthCart();
  const router = useRouter();
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{
    product: StoreProduct;
    variantId: string;
    action: 'cart' | 'book';
  } | null>(null);
  const loader = useRef<HTMLDivElement>(null);
  const products = useMemo<StoreProduct[]>(
    () =>
      data?.pages.flatMap((page) =>
        page.data.map((product) => {
          const sizes = product.variants
            .filter((variant) => variant.stock > 0)
            .map((variant) => ({ id: variant.id, label: variant.size.label }));
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

  const [filterCount, setFilterCount] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilterCount((params.get('brandId') ? 1 : 0) + (params.get('categoryId') ? 1 : 0));
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem('prime-kicks-open-login') === 'true') {
      window.localStorage.removeItem('prime-kicks-open-login');
      setLoginOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const timer = setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setToast(''), 250);
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function addToCart(product: StoreProduct, variantId: string, action: 'cart' | 'book') {
    if (!user) {
      setPendingAdd({ product, variantId, action });
      setLoginOpen(true);
      return;
    }
    try {
      await api.addToCart(product.id, variantId);
      notifyStore();
      if (action === 'book') {
        router.push('/cart');
        return;
      }
      setToast(`${product.name} added to your bag`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) setToast(error.message);
      else setToast("We couldn't add this pair. Please try again.");
    }
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
          <em className="font-[Georgia,serif] font-normal tracking-[-.1em]">what's next.</em>
        </h1>
        <a
          className="text-white bg-ink border border-[rgba(255,255,255,0.3)] no-underline uppercase text-[11px] font-bold tracking-[.09em] py-[15px] px-[17px] inline-flex gap-[22px] items-center transition-[transform,background] duration-200 hover:translate-x-[5px] hover:bg-[#31302d] [&_svg]:w-[16px] [&_svg]:h-[16px]"
          href="/search"
        >
          Shop new arrivals <Icon name="arrow" />
        </a>
        <div className="hero-orb" />
      </section>

      <section
        className="pt-[74px] px-[5.25vw] pb-[42px] max-[800px]:pt-[43px] max-[800px]:px-[15px] max-[800px]:pb-[20px]"
        id="shop"
      >
        <div className="flex items-center justify-between gap-[16px] mb-[27px]">
          <div>
            <h2 className="text-[38px] tracking-[-.07em] m-0 leading-[.9] max-[800px]:text-[31px]">
              Fresh drops
            </h2>
          </div>
        </div>
        <div
          className="grid grid-cols-4 gap-x-[16px] gap-y-[27px] max-[800px]:grid-cols-2 max-[800px]:gap-x-[10px] max-[800px]:gap-y-[28px] min-[801px]:max-[1100px]:grid-cols-3"
          id="new"
        >
          {products.slice(0, 4).map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={addToCart}
              priority={index < 4}
              isHomePage
            />
          ))}
          {isLoading && Array.from({ length: 4 }, (_, index) => <ProductSkeleton key={index} />)}
        </div>
        {isLoading && (
          <div className="h-[130px] flex items-center justify-center gap-[10px] text-[10px] tracking-[.1em] uppercase text-[#666] max-[800px]:h-[100px]">
            <i className="w-[15px] h-[15px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
            Loading fresh drops
          </div>
        )}
        {isError && (
          <div className="text-center text-[13px] text-[#666] pt-[40px] px-0 pb-[70px]">
            <p>We couldn't load the catalogue. Check that the product API is running.</p>
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
          <div className="mt-[40px] flex justify-center  ">
            <Link
              href="/search"
              className="text-white bg-ink border border-[rgba(255,255,255,0.3)] no-underline uppercase text-[11px] font-bold tracking-[.09em] py-[11px] px-[15px] inline-flex gap-[22px] items-center transition-[transform,background] duration-200 hover:translate-x-[5px] hover:bg-[#31302d] [&_svg]:w-[16px] [&_svg]:h-[16px]"
            >
              View more <Icon name="arrow" />
            </Link>
          </div>
        )}
      </section>
      <SiteFooter />
      <Toast message={toast} visible={toastVisible} />
      <FilterDrawer />
      {loginOpen && (
        <LoginModal
          onClose={() => {
            setLoginOpen(false);
            setPendingAdd(null);
          }}
          onSuccess={async () => {
            if (pendingAdd) {
              try {
                await api.addToCart(pendingAdd.product.id, pendingAdd.variantId);
                notifyStore();
                if (pendingAdd.action === 'book') {
                  await refresh();
                  setPendingAdd(null);
                  router.push('/cart');
                  return;
                }
                setToast(`${pendingAdd.product.name} added to your bag`);
              } catch (error) {
                if (error instanceof ApiError && error.status === 400) setToast(error.message);
                else setToast("We couldn't add this pair. Please try again.");
              }
              setPendingAdd(null);
            } else setToast('Welcome back.');
            await refresh();
            notifyStore();
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
