'use client';

import { FadeSection } from '@/components/fade-section';
import { Icon } from '@/components/icon';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

type Item = { src: string; index: number };

/** Movement past this many px turns a press into a drag (so it never opens the lightbox). */
const DRAG_THRESHOLD = 6;
/** Release speed cap (px/s) so a hard flick can't send the row flying. */
const MAX_FLING = 2400;

/**
 * Repeating diagonal "Prime Kicks" watermark laid over a review screenshot so
 * any screen-grab carries the brand. Decorative and never interactive.
 */
function Watermark() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-[22px] overflow-hidden select-none opacity-[0.16] [transform:rotate(-24deg)_scale(1.5)]"
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={i}
          className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[.4em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]"
        >
          Prime Kicks · Prime Kicks · Prime Kicks · Prime Kicks
        </span>
      ))}
    </span>
  );
}

/**
 * One row of screenshots that drifts on its own, can be dragged or swiped (mouse
 * and touch), keeps its momentum when let go, and eases to a stop under the
 * pointer / back into motion — all driven by one rAF loop writing `transform`
 * only, so it stays on the GPU. Cards near the centre are slightly larger and
 * a touch larger. Runs only while on screen and while the tab is visible; visitors who
 * prefer reduced motion get no drift but can still swipe.
 */
function ReviewRow({
  items,
  direction,
  speed,
  startOffset,
  onOpen,
}: {
  items: Item[];
  /** 1 drifts left, -1 drifts right. */
  direction: 1 | -1;
  /** Drift speed in px/s. */
  speed: number;
  /** Where in the loop the row starts (0–1). */
  startOffset: number;
  onOpen: (index: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // One "set" must be wider than any screen, so repeat the list to ≥ 12 cards and
  // render two identical sets: the loop wraps by exactly one set's width.
  const set = (() => {
    const out: Item[] = [];
    while (out.length < 12) out.push(...items);
    return out;
  })();

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = reduceMotion ? 0 : -direction * speed;

    let x = 0;
    let vel = base;
    let period = 1;
    let viewWidth = 1;
    let layout: { el: HTMLElement; center: number }[] = [];

    let hovered = false;
    let dragging = false;
    let captured = false;
    let moved = 0;
    let lastX = 0;
    let lastT = 0;
    let fling = 0;
    let pointerId = -1;

    let raf = 0;
    let last = 0;
    let visible = false;

    const measure = () => {
      const cards = Array.from(track.children) as HTMLElement[];
      const half = cards.length / 2;
      const first = cards[0];
      const second = cards[half];
      if (!first || !second) return;
      period = second.offsetLeft - first.offsetLeft || 1;
      viewWidth = viewport.clientWidth;
      layout = cards.map((el) => ({ el, center: el.offsetLeft + el.offsetWidth / 2 }));
    };

    const wrap = (value: number) => {
      let v = value % period;
      if (v > 0) v -= period;
      return v;
    };

    const paint = () => {
      track.style.transform = `translate3d(${x}px,0,0)`;
      const mid = viewWidth / 2;
      for (const { el, center } of layout) {
        // Distance from the middle of the viewport, 0 (centre) → 1 (edge).
        const d = Math.min(1, Math.abs(center + x - mid) / mid);
        const scale = 1 - 0.09 * d * d;
        el.style.transform = `scale(${scale})`;
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!dragging) {
        // Ease the velocity toward the drift speed (or toward rest while hovered):
        // this is what makes stopping and starting feel smooth, not abrupt.
        const target = hovered ? 0 : base;
        vel += (target - vel) * (1 - Math.exp(-dt * 2.6));
        x = wrap(x + vel * dt);
      }
      paint();
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    const start = () => {
      if (!raf && visible && document.visibilityState === 'visible') {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    measure();
    x = wrap(-period * startOffset);
    paint();

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) start();
      },
      { rootMargin: '120px' },
    );
    io.observe(viewport);

    const ro = new ResizeObserver(() => {
      measure();
      x = wrap(x);
      paint();
    });
    ro.observe(viewport);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      captured = false;
      moved = 0;
      fling = 0;
      lastX = e.clientX;
      lastT = performance.now();
      pointerId = e.pointerId;
      viewport.dataset.moved = '0';
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - lastX;
      const now = performance.now();
      moved += Math.abs(dx);
      // Only start owning the gesture once it is clearly a drag, so a plain tap
      // still reaches the card underneath.
      if (!captured && moved > DRAG_THRESHOLD) {
        captured = true;
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add('is-dragging');
      }
      if (captured) {
        x = wrap(x + dx);
        const inst = (dx / Math.max(1, now - lastT)) * 1000;
        fling = fling * 0.6 + inst * 0.4;
        viewport.dataset.moved = String(moved);
        paint();
      }
      lastX = e.clientX;
      lastT = now;
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      viewport.classList.remove('is-dragging');
      if (captured) {
        vel = Math.max(-MAX_FLING, Math.min(MAX_FLING, fling));
        if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
      }
      start();
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovered = true;
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovered = false;
    };

    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);
    viewport.addEventListener('pointerenter', onEnter);
    viewport.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      viewport.removeEventListener('pointerdown', onDown);
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerup', onUp);
      viewport.removeEventListener('pointercancel', onUp);
      viewport.removeEventListener('pointerenter', onEnter);
      viewport.removeEventListener('pointerleave', onLeave);
    };
  }, [direction, speed, startOffset, items]);

  return (
    <div
      ref={viewportRef}
      // pan-y: vertical swipes still scroll the page; horizontal ones drag the row.
      className="relative cursor-grab select-none overflow-hidden pt-[14px] pb-[26px] max-[800px]:pb-[18px] [touch-action:pan-y] [&.is-dragging]:cursor-grabbing"
    >
      <div
        ref={trackRef}
        className="flex w-max gap-[18px] will-change-transform max-[800px]:gap-[12px]"
      >
        {[...set, ...set].map(({ src, index }, i) => (
          <div key={`${src}-${i}`} className="shrink-0will-change-transform">
            <button
              type="button"
              onClick={() => {
                if (Number(viewportRef.current?.dataset.moved ?? 0) > DRAG_THRESHOLD) return;
                onOpen(index);
              }}
              aria-label="Open customer review"
              tabIndex={i < set.length ? 0 : -1}
              aria-hidden={i >= set.length}
              className="group/card block aspect-[9/16] w-[220px] cursor-[inherit] overflow-hidden rounded-[24px] border border-line bg-white p-0 shadow-[0_8px_20px_-10px_rgba(23,23,22,0.3)] transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-[6px] hover:shadow-[0_14px_24px_-12px_rgba(23,23,22,0.34)] focus-visible:outline-2 focus-visible:outline-ink max-[800px]:w-[172px] max-[800px]:rounded-[20px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={i < set.length ? 'WhatsApp message from a Prime Kicks customer' : ''}
                loading="lazy"
                decoding="async"
                draggable={false}
                onContextMenu={(event) => event.preventDefault()}
                className="pointer-events-none block h-full w-full select-none object-cover object-top transition-transform duration-700 ease-out group-hover/card:scale-[1.04]"
              />
              <Watermark />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Customer reviews as WhatsApp screenshots — a single row of equal-size cards
 * drifting on its own that visitors can drag or swipe, with an enlarge-on-tap
 * lightbox (swipe, arrow keys, Escape). Renders nothing when there are no images.
 */
export function ReviewScreenshots({ images }: { images: string[] }) {
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (delta: number) =>
      setActive((current) =>
        current === null ? null : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [active, close, step]);

  if (images.length === 0) return null;

  const indexed: Item[] = images.map((src, index) => ({ src, index }));

  return (
    <FadeSection
      className="scroll-mt-[92px] pt-[42px] pb-0 overflow-hidden max-[800px]:scroll-mt-[76px] max-[800px]:pt-[28px] max-[800px]:pb-0"
      id="reviews"
    >
      <motion.div
        className="px-[5.25vw] mb-[27px] max-[800px]:px-[15px] max-[800px]:mb-[20px]"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <p className="m-0 mb-[12px] flex items-center gap-[10px] text-[10px] font-bold uppercase tracking-[.16em] text-accent">
          <span aria-hidden="true" className="h-px w-[28px] bg-accent" />
          Customer reviews
        </p>
        <div className="flex items-end justify-between gap-[16px]">
          <h2 className="text-[38px] tracking-[-.07em] m-0 leading-[.9] max-[800px]:text-[31px]">
            Sole <em className="font-[Georgia,serif] font-normal">stories.</em>
          </h2>
          <span className="shrink-0 pb-[4px] text-[10px] font-bold uppercase tracking-[.14em] text-[#a7a29a] max-[800px]:hidden">
            Drag to explore →
          </span>
        </div>
      </motion.div>

      <div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <ReviewRow items={indexed} direction={1} speed={30} startOffset={0} onOpen={setActive} />
        </motion.div>
      </div>

      <AnimatePresence>
        {active !== null && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(12,12,11,0.88)] px-[16px] backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="Customer review"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-[18px] top-[18px] z-[2] grid h-[42px] w-[42px] place-items-center rounded-full border-0 bg-white/10 text-white backdrop-blur [&_svg]:h-[20px] [&_svg]:w-[20px]"
            >
              <Icon name="close" />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    step(-1);
                  }}
                  aria-label="Previous review"
                  className="absolute left-[14px] top-1/2 z-[2] grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-full border-0 bg-white/10 text-white backdrop-blur max-[800px]:hidden [&_svg]:h-[20px] [&_svg]:w-[20px] [&_svg]:rotate-180"
                >
                  <Icon name="arrow" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    step(1);
                  }}
                  aria-label="Next review"
                  className="absolute right-[14px] top-1/2 z-[2] grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-full border-0 bg-white/10 text-white backdrop-blur max-[800px]:hidden [&_svg]:h-[20px] [&_svg]:w-[20px]"
                >
                  <Icon name="arrow" />
                </button>
              </>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="relative flex w-fit cursor-grab overflow-hidden rounded-[20px] active:cursor-grabbing"
                initial={{ opacity: 0, scale: 0.94, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                // Swipe left/right on a phone to move between reviews.
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -70 || info.velocity.x < -500) step(1);
                  else if (info.offset.x > 70 || info.velocity.x > 500) step(-1);
                }}
                onClick={(event) => event.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[active]}
                  alt="WhatsApp message from a Prime Kicks customer"
                  draggable={false}
                  onContextMenu={(event) => event.preventDefault()}
                  className="max-h-[84vh] w-auto max-w-[min(92vw,460px)] bg-white object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
                />
                <Watermark />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </FadeSection>
  );
}
