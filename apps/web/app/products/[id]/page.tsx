'use client';

import { AnimatedLabel } from '@/components/added-label';
import { Announcement } from '@/components/announcement';
import { Icon } from '@/components/icon';
import { LoginModal } from '@/components/login-modal';
import { ProductCard, toStoreProduct } from '@/components/product-card';
import { ProductVideo } from '@/components/product-video';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Toast } from '@/components/toast';
// import TestimonialMarquee from '@/components/ui/marquee-01';
import { ApiError, api } from '@/lib/api';
import { notifyStore, useProduct, useSimilarProducts } from '@/lib/hooks';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useRef, useState } from 'react';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: product, isLoading, isError } = useProduct(id);
  const { data: similar = [] } = useSimilarProducts(id);
  const [activeMedia, setActiveMedia] = useState(0);
  const [size, setSize] = useState('');
  const [message, setMessage] = useState('');
  const [messageVisible, setMessageVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [shake, setShake] = useState(false);
  // Confirmation state for "Add to cart" only — Buy now just redirects.
  const [done, setDone] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const carousel = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  function scrollToIndex(index: number) {
    const el = carousel.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (!child) return;
    el.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
  }

  function handleScroll() {
    const el = carousel.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    let closest = 0;
    let closestDist = Infinity;
    Array.from(el.children).forEach((child, index) => {
      const pos = (child as HTMLElement).offsetLeft;
      const dist = Math.abs(pos - scrollLeft);
      if (dist < closestDist) {
        closestDist = dist;
        closest = index;
      }
    });
    setActiveMedia(closest);
  }
  const sizes = useMemo(
    () => product?.variants.filter((variant) => variant.stock > 0) ?? [],
    [product],
  );
  const activeSize = size;
  const media = product
    ? [
        ...(product.videoUrl
          ? [{ type: 'video' as const, src: product.videoUrl, label: 'Video' }]
          : []),
        ...product.photoUrls.map((src, index) => ({
          type: 'image' as const,
          src,
          label: `View ${index + 1}`,
        })),
      ]
    : [];

  function moveCarousel(direction: -1 | 1) {
    const next = Math.min(Math.max(activeMedia + direction, 0), media.length - 1);
    setActiveMedia(next);
    scrollToIndex(next);
  }

  useEffect(() => {
    if (!message) return;
    setMessageVisible(true);
    const timer = setTimeout(() => {
      setMessageVisible(false);
      setTimeout(() => setMessage(''), 300);
    }, 4200);
    return () => clearTimeout(timer);
  }, [message]);

  async function addToBag(action: 'cart' | 'book') {
    if (!sizes.length) return;
    if (!activeSize) {
      setShake(true);
      return;
    }
    const selectedVariant = sizes.find((variant) => variant.size.label === activeSize);
    if (!selectedVariant) return;
    setAdding(true);
    try {
      await api.addToCart(id, selectedVariant.id);
      notifyStore();
      if (action === 'book') {
        // Buy now just redirects to the cart — no confirmation animation needed.
        router.push('/cart');
        return;
      }
      // Confirm a real add-to-cart with the on-brand tick animation.
      setDone(true);
      clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(false), 1700);
      setMessage('Added to your bag.');
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') setLoginOpen(true);
      else if (error instanceof ApiError) setMessage(error.message);
      else setMessage("We couldn't add this pair. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  function share(network: 'whatsapp' | 'facebook' | 'instagram' | 'copy') {
    const url = window.location.href;
    const text = `Check out ${product?.name ?? 'this pair'} on Prime Kicks`;
    if (network === 'whatsapp')
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
        '_blank',
        'noopener,noreferrer',
      );
    else if (network === 'facebook')
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        '_blank',
        'noopener,noreferrer',
      );
    else {
      navigator.clipboard?.writeText(url);
      setMessage(
        network === 'instagram'
          ? 'Link copied — open Instagram to share it.'
          : 'Product link copied.',
      );
    }
  }

  if (isLoading)
    return (
      <main className="min-h-screen grid place-content-center gap-[10px] text-center text-[12px]">
        <i className="w-[18px] h-[18px] m-auto border-2 border-[#ddd] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
        Loading product
      </main>
    );
  if (isError || !product)
    return (
      <main className="min-h-screen grid place-content-center gap-[10px] text-center text-[12px]">
        Product not found. <Link href="/">Back to shop</Link>
      </main>
    );

  return (
    <main className="min-h-screen bg-white">
      <Announcement />
      <SiteHeader />

      <div className="max-w-[1480px] mx-auto pt-[21px] px-[5.25vw] pb-[17px] flex items-center gap-[8px] text-[10px] text-[#777] whitespace-nowrap overflow-hidden max-[760px]:pt-[16px] max-[760px]:px-[15px] max-[760px]:pb-[14px]">
        <Link
          className="text-[10px] uppercase tracking-[.08em] font-bold text-ink no-underline"
          href="/"
        >
          Shop
        </Link>
        <span>/</span>
        <span>{product.brand}</span>
        <span>/</span>
        <b className="overflow-hidden text-ellipsis font-normal">{product.name}</b>
      </div>
      <section className="max-w-[1480px] mx-auto px-[5.25vw] pb-[92px] grid grid-cols-[minmax(0,1.3fr)_minmax(315px,0.7fr)] gap-[clamp(35px,6vw,96px)] max-[760px]:block max-[760px]:px-[15px] max-[760px]:pb-[58px]">
        <div className="min-w-0">
          <div className="flex justify-between items-center mb-[11px]">
            <p className="m-0 text-[10px] tracking-[.16em] uppercase font-bold">Product gallery</p>
            <span className="text-[10px] tracking-[.1em] text-[#777]">
              {media.length ? `${activeMedia + 1} / ${media.length}` : '01 / 01'}
            </span>
          </div>
          <div className="relative">
            <div
              className="flex gap-[12px] overflow-x-auto [scroll-snap-type:x_mandatory] [scrollbar-width:none] p-[1px_1px_12px] scroll-smooth [&::-webkit-scrollbar]:hidden max-[760px]:gap-[10px] max-[760px]:pb-[10px]"
              ref={carousel}
              onScroll={handleScroll}
              aria-label={`${product.name} media gallery`}
            >
              {media.length ? (
                media.map((item, index) => (
                  <article
                    className={`relative flex-[0_0_calc(50%-6px)] aspect-[1/1.08] overflow-hidden border rounded-[16px] bg-[#e8e6e0] shadow-[0_10px_24px_rgba(28,22,16,0.1)] [scroll-snap-align:start] cursor-pointer transition-[transform,box-shadow,border-color] duration-[250ms] hover:-translate-y-[3px] hover:shadow-[0_16px_30px_rgba(28,22,16,0.16)] max-[760px]:basis-[82%] max-[760px]:rounded-[13px] ${activeMedia === index ? 'border-ink' : 'border-transparent'}`}
                    key={`${item.type}-${item.src}`}
                    onClick={() => {
                      setActiveMedia(index);
                      scrollToIndex(index);
                    }}
                  >
                    {item.type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="w-full h-full block object-cover"
                        src={item.src}
                        alt={`${product.name} — ${item.label}`}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        decoding="async"
                      />
                    ) : (
                      <>
                        <ProductVideo
                          src={item.src}
                          poster={product.photoUrls[0]}
                          label={`${product.name} video`}
                        />
                      </>
                    )}
                  </article>
                ))
              ) : (
                <article className="relative flex-[0_0_calc(50%-6px)] aspect-[1/1.08] overflow-hidden border border-transparent rounded-[16px] bg-[#e8e6e0] shadow-[0_10px_24px_rgba(28,22,16,0.1)] [scroll-snap-align:start] cursor-default transition-[transform,box-shadow,border-color] duration-[250ms] hover:-translate-y-[3px] hover:shadow-[0_16px_30px_rgba(28,22,16,0.16)] max-[760px]:basis-[82%] max-[760px]:rounded-[13px]">
                  <div className="h-full grid place-items-center p-[20px] bg-[linear-gradient(145deg,#e9e7df,#cfcac0)] text-[18px] font-bold tracking-[.12em] text-center">
                    {product.brand}
                  </div>
                </article>
              )}
            </div>
            {media.length > 1 && (
              <div className="absolute right-[13px] bottom-[25px] flex gap-[6px] max-[760px]:hidden">
                <button
                  className="w-[34px] h-[34px] border border-[#ffffff88] rounded-full bg-white text-ink grid place-items-center shadow-[0_5px_15px_#0002] disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:w-[16px]"
                  onClick={() => moveCarousel(-1)}
                  disabled={activeMedia === 0}
                  aria-label="Previous media"
                >
                  <Icon name="chevron-left" />
                </button>
                <button
                  className="w-[34px] h-[34px] border border-[#ffffff88] rounded-full bg-white text-ink grid place-items-center shadow-[0_5px_15px_#0002] disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:w-[16px]"
                  onClick={() => moveCarousel(1)}
                  disabled={activeMedia === media.length - 1}
                  aria-label="Next media"
                >
                  <Icon name="chevron-right" />
                </button>
              </div>
            )}
          </div>
          <div
            className="flex gap-[6px] mt-[2px] max-[760px]:mt-[1px]"
            aria-label="Choose product media"
          >
            {media.map((item, index) => (
              <button
                key={`${item.label}-${index}`}
                className={`h-[3px] border-0 rounded-[99px] p-0 transition-[width,background] duration-200 ${activeMedia === index ? 'w-[38px] bg-ink' : 'w-[22px] bg-[#ddd]'}`}
                onClick={() => {
                  setActiveMedia(index);
                  scrollToIndex(index);
                }}
                aria-label={`Show ${item.label}`}
              />
            ))}
          </div>
        </div>

        <aside className="pt-[21px] animate-[enter_0.5s_0.1s_both] max-[760px]:pt-[30px]">
          {product.tags.filter((tag) => tag.isActive).length > 0 && (
            <div className="flex flex-wrap gap-[7px] mb-[15px]">
              {product.tags
                .filter((tag) => tag.isActive)
                .map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-accent text-white text-[10px] font-bold uppercase tracking-[.07em] px-[12px] py-[6px] shadow-[0_3px_10px_rgba(0,0,0,0.14)]"
                  >
                    {tag.name}
                  </span>
                ))}
            </div>
          )}
          <h1 className="text-[clamp(37px,4vw,64px)] tracking-[-.085em] leading-[.88] m-0 max-w-[550px] max-[760px]:text-[42px]">
            {product.brand} {product.name}
          </h1>
          <p className="flex items-baseline gap-[10px] mt-[20px] mb-[7px]">
            <s className="text-[16px] text-[#9a9a9a]">
              {formatCurrency(product.price * 2, product.currency)}
            </s>
            <span className="text-[21px] font-bold">
              {formatCurrency(product.price, product.currency)}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[.06em] text-accent">
              50% off
            </span>
          </p>

          <div className="border-t border-line py-[20px]">
            <div className="flex justify-between text-[10px] uppercase tracking-[.08em]">
              <span>Select size</span>
            </div>
            <div
              className={`flex flex-wrap gap-[7px] mt-[15px]${shake ? ' animate-shake' : ''}`}
              onAnimationEnd={() => setShake(false)}
            >
              {sizes.map((variant) => (
                <button
                  key={variant.id}
                  className={`px-[10px] h-[39px] border rounded-[8px] transition duration-200 text-[12px] ${activeSize === variant.size.label ? 'bg-accent text-white border-accent font-bold' : 'bg-white border-line hover:border-ink'}`}
                  onClick={() => setSize(variant.size.label)}
                  aria-label={`Choose size ${variant.size.label}`}
                >
                  {variant.size.conversion
                    ? `${variant.size.label} - ${variant.size.conversion}`
                    : variant.size.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-[7px] max-[760px]:grid-cols-1">
            <button
              className={`relative overflow-hidden h-[49px] rounded-[9px] uppercase tracking-[.08em] text-[10px] font-bold transition-[transform,background-color,color,border-color] duration-300 enabled:hover:-translate-y-[2px] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-[.42] border flex items-center justify-center gap-[10px] [&_svg]:w-[15px] ${
                done
                  ? 'border-accent bg-accent text-white'
                  : 'bg-white border-ink enabled:hover:bg-[#f3f1ec]'
              }`}
              disabled={!sizes.length || adding}
              onClick={() => addToBag('cart')}
            >
              {adding ? (
                'Adding…'
              ) : (
                <AnimatedLabel
                  done={done}
                  label="Added"
                  idle={
                    <>
                      <span className="inline-flex max-[760px]:hidden" aria-hidden="true">
                        <Icon name="bag" />
                      </span>
                      Add to cart
                    </>
                  }
                />
              )}
            </button>
            <button
              className="h-[49px] rounded-[8px] uppercase tracking-[.08em] text-[10px] font-bold transition-[transform,background] duration-200 enabled:hover:-translate-y-[2px] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-[.42] bg-ink text-white border-0 flex items-center justify-center gap-[12px] shadow-[0_8px_17px_#17171620] enabled:hover:bg-[#393834] [&_svg]:w-[15px]"
              disabled={!sizes.length || adding}
              onClick={() => addToBag('book')}
            >
              {adding ? 'Adding…' : 'Book now'}
              <span className="inline-flex max-[760px]:hidden" aria-hidden="true">
                <Icon name="arrow" />
              </span>
            </button>
          </div>
          <div className="border-t border-line mt-[29px] pt-[20px]">
            <h2 className="text-[10px] uppercase tracking-[.09em] m-0 font-bold">Description</h2>
            <p className="text-[13px] leading-[1.65] text-[#666] mt-[12px]">
              {product.description ||
                'An authentic Prime Kicks selection, inspected for quality and ready for its next rotation.'}
            </p>
          </div>
          <div className="border-t border-line mt-[29px] pt-[20px]">
            <span className="text-[10px] uppercase tracking-[.09em] m-0 font-bold flex items-center gap-[7px] [&_svg]:w-[14px]">
              <Icon name="share" /> Share this pair
            </span>
            <div className="flex flex-wrap gap-[7px] mt-[13px]">
              <button
                className="border border-line bg-white rounded-full px-[11px] py-[8px] text-[10px] transition duration-200 hover:border-ink hover:bg-[#f4f2ed] max-[760px]:px-[10px]"
                onClick={() => share('whatsapp')}
              >
                WhatsApp
              </button>
              <button
                className="border border-line bg-white rounded-full px-[11px] py-[8px] text-[10px] transition duration-200 hover:border-ink hover:bg-[#f4f2ed] max-[760px]:px-[10px]"
                onClick={() => share('facebook')}
              >
                Facebook
              </button>
              <button
                className="border border-line bg-white rounded-full px-[11px] py-[8px] text-[10px] transition duration-200 hover:border-ink hover:bg-[#f4f2ed] max-[760px]:px-[10px]"
                onClick={() => share('instagram')}
              >
                Instagram
              </button>
              <button
                className="border border-line bg-white rounded-full px-[11px] py-[8px] text-[10px] transition duration-200 hover:border-ink hover:bg-[#f4f2ed] max-[760px]:px-[10px]"
                onClick={() => share('copy')}
              >
                Copy link
              </button>
            </div>
          </div>
        </aside>
      </section>

      {similar.length > 0 && (
        <section className="max-w-[1480px] mx-auto px-[5.25vw] pb-[92px] max-[760px]:px-[15px] max-[760px]:pb-[58px]">
          <div className="border-t border-line pt-[34px]">
            <h2 className="text-[clamp(20px,2.4vw,30px)] tracking-[-.05em] leading-[1] m-0">
              Similar products
            </h2>
            {/* Horizontal rail: up to 8 browse-only cards (no size/add-to-cart). */}
            <div className="mt-[22px] flex gap-[16px] overflow-x-auto pb-[10px] [scroll-snap-type:x_mandatory] [scrollbar-width:thin] max-[760px]:gap-[12px]">
              {similar.map((item, index) => (
                <div
                  key={item.id}
                  className="flex-[0_0_240px] [scroll-snap-align:start] max-[760px]:flex-[0_0_62%]"
                >
                  <ProductCard
                    product={toStoreProduct(item)}
                    showActions={false}
                    priority={index < 4}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Customer testimonials marquee — enable when ready.
      <section className="max-w-[1480px] mx-auto px-[5.25vw] pb-[92px] max-[760px]:px-[15px] max-[760px]:pb-[58px]">
        <div className="border-t border-line pt-[34px]">
          <h2 className="text-[clamp(20px,2.4vw,30px)] tracking-[-.05em] leading-[1] m-0">
            What our customers say
          </h2>
          <div className="mt-[22px]">
            <TestimonialMarquee />
          </div>
        </div>
      </section>
      */}

      <SiteFooter />
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={() => setMessage('Signed in — choose your size and add this pair.')}
        />
      )}
      <Toast message={message} visible={messageVisible} />
    </main>
  );
}
