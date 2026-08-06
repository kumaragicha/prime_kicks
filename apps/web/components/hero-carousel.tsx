'use client';

import { Icon } from '@/components/icon';
import type { HeroSlide } from '@/lib/api';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

const AUTOPLAY_MS = 5500;

/**
 * Storefront hero carousel. Slides crossfade (image + text + CTA together),
 * auto-advancing unless the visitor hovers or prefers reduced motion. Fully
 * responsive — the same layout scales from mobile to desktop via the shared
 * hero type sizes. Images are served as the WebP the admin upload produced.
 */
/** Horizontal drag past this many px triggers a slide change. */
const SWIPE_THRESHOLD = 50;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || paused || reduceMotion.current) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % slides.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(id);
  }, [slides.length, paused]);

  const go = (dir: 1 | -1) =>
    setActive((i) => (i + dir + slides.length) % slides.length);

  // Pointer Events unify touch (mobile swipe) and mouse (desktop drag).
  const onPointerDown = (e: PointerEvent) => {
    if (slides.length <= 1) return;
    dragStartX.current = e.clientX;
    setPaused(true);
  };
  const endDrag = (clientX: number | null) => {
    const start = dragStartX.current;
    dragStartX.current = null;
    setPaused(false);
    if (start == null || clientX == null) return;
    const dx = clientX - start;
    if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1);
  };

  return (
    <section
      className={`relative min-h-[492px] overflow-hidden bg-[#d9d7d0] text-white isolate select-none max-[800px]:min-h-[370px] ${
        slides.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      id="top"
      style={{ touchAction: 'pan-y' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        dragStartX.current = null;
      }}
      onPointerDown={onPointerDown}
      onPointerUp={(e) => endDrag(e.clientX)}
      onPointerCancel={() => endDrag(null)}
      aria-roledescription="carousel"
    >
      {slides.map((slide, i) => {
        const isActive = i === active;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!isActive}
          >
            <div
              className="absolute inset-0 bg-cover bg-[center_42%] max-[800px]:bg-[58%_center]"
              style={{
                backgroundImage: `url(${slide.imageUrl})`,
                transform: isActive && !reduceMotion.current ? 'scale(1.06)' : 'scale(1.02)',
                transition: 'transform 6s ease-out',
              }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.68),rgba(0,0,0,0.12)_72%)]" />

            <div className="relative flex min-h-[492px] flex-col justify-center py-[82px] px-[7vw] max-[800px]:min-h-[370px] max-[800px]:py-[58px] max-[800px]:px-[21px]">
              {slide.subtitle && (
                <p className="m-0 mb-[13px] text-[10px] font-bold uppercase tracking-[.16em] max-[800px]:text-[9px]">
                  {slide.subtitle}
                </p>
              )}
              {slide.title && (
                <h1 className="m-0 mb-[33px] text-[clamp(40px,7.2vw,104px)] font-[900] uppercase leading-[.86] tracking-[-.05em] max-[800px]:text-[48px] max-[800px]:mb-[24px]">
                  {slide.title}
                </h1>
              )}
              {slide.ctaLabel && slide.ctaHref && (
                <a
                  className="inline-flex w-fit items-center gap-[22px] rounded-[8px] border border-[rgba(255,255,255,0.3)] bg-ink px-[17px] py-[15px] text-[11px] font-bold uppercase tracking-[.09em] text-white no-underline transition-[transform,background] duration-200 hover:translate-x-[5px] hover:bg-[#31302d] [&_svg]:h-[16px] [&_svg]:w-[16px]"
                  href={slide.ctaHref}
                >
                  {slide.ctaLabel} <Icon name="arrow" />
                </a>
              )}
            </div>
          </div>
        );
      })}

      {slides.length > 1 && (
        <div className="absolute bottom-[22px] left-[7vw] z-[2] flex gap-[9px] max-[800px]:left-[21px] max-[800px]:bottom-[16px]">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={`h-[3px] rounded-full transition-all duration-300 ${
                i === active ? 'w-[30px] bg-white' : 'w-[14px] bg-white/45 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
