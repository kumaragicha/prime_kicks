'use client';

import { Announcement } from '@/components/announcement';
import { FilterDrawer } from '@/components/filter-drawer';
import { Icon } from '@/components/icon';
import { LoginModal } from '@/components/login-modal';
import { type StoreProduct } from '@/components/product-card';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TagCollection } from '@/components/tag-collection';
import { Toast } from '@/components/toast';
import { ApiError, api, type HeroSlide } from '@/lib/api';
import { HeroCarousel } from '@/components/hero-carousel';
import { notifyStore, useAuthCart, useHeroSlides } from '@/lib/hooks';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

/**
 * Curated homepage sections, each backed by a merchandising tag. `id` is the
 * scroll anchor the header nav links target (e.g. "New arrivals" → /#new).
 */
const TAG_SECTIONS = [
  { title: 'New arrivals', tag: 'New Arrivals', id: 'new' },
  { title: 'Hot selling', tag: 'Hot Selling', id: 'shop' },
] as const;

/**
 * Interactive storefront home. Rendered by the server component in `page.tsx`,
 * which fetches the hero slides on the server and hands them in as
 * `initialHeroSlides` — so the banner image + copy are in the first HTML the
 * visitor receives (no client-side loading flash), then react-query keeps them
 * fresh in the background.
 */
export function HomeClient({ initialHeroSlides }: { initialHeroSlides: HeroSlide[] }) {
  const { data: heroSlides } = useHeroSlides(initialHeroSlides);
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
    }, 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Returns true only when the item was actually added, so the card's
  // confirmation animation reflects reality (not the login/redirect paths).
  async function addToCart(
    product: StoreProduct,
    variantId: string,
    action: 'cart' | 'book',
  ): Promise<boolean> {
    if (!user) {
      setPendingAdd({ product, variantId, action });
      setLoginOpen(true);
      return false;
    }
    try {
      await api.addToCart(product.id, variantId);
      notifyStore();
      if (action === 'book') {
        router.push('/cart');
        return true;
      }
      setToast(`${product.name} added to your bag`);
      return true;
    } catch (error) {
      setToast(
        error instanceof ApiError ? error.message : "We couldn't add this pair. Please try again.",
      );
      return false;
    }
  }

  return (
    <main>
      <Announcement />
      <SiteHeader />

      {heroSlides && heroSlides.length > 0 ? (
        <HeroCarousel slides={heroSlides} />
      ) : (
        <section
          className="relative min-h-[492px] py-[82px] px-[7vw] overflow-hidden bg-[#d9d7d0] text-white isolate after:content-[''] after:absolute after:inset-0 after:bg-[linear-gradient(90deg,rgba(0,0,0,0.68),rgba(0,0,0,0.12)_72%)] after:-z-[1] max-[800px]:min-h-[370px] max-[800px]:py-[58px] max-[800px]:px-[21px]"
          id="top"
        >
          <div className="hero-media max-[800px]:!bg-[58%_center]" aria-hidden="true" />
          <h1 className="hero-rise text-[clamp(48px,7.6vw,110px)] tracking-[-.06em] leading-[.86] m-0 mb-[33px] font-[900] uppercase max-[800px]:text-[57px]">
            From Sole
            <br />
            to <span className="text-accent">Soul.</span>
          </h1>
          <a
            className="hero-rise text-white bg-ink border border-[rgba(255,255,255,0.3)] rounded-[8px] no-underline uppercase text-[11px] font-bold tracking-[.09em] py-[15px] px-[17px] inline-flex gap-[22px] items-center transition-[transform,background] duration-200 hover:translate-x-[5px] hover:bg-[#31302d] [&_svg]:w-[16px] [&_svg]:h-[16px] [animation-delay:0.15s]"
            href="/search"
          >
            Shop new arrivals <Icon name="arrow" />
          </a>
          <div className="hero-orb" />
        </section>
      )}

      {TAG_SECTIONS.map((section, index) => (
        <TagCollection
          key={section.tag}
          title={section.title}
          tag={section.tag}
          onAdd={addToCart}
          priority={index === 0}
          id={section.id}
        />
      ))}
      <SiteFooter />
      <Toast message={toast} visible={toastVisible} />
      <Suspense fallback={null}>
        <FilterDrawer />
      </Suspense>
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
                setToast(
                  error instanceof ApiError
                    ? error.message
                    : "We couldn't add this pair. Please try again.",
                );
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
