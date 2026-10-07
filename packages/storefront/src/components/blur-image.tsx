'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Stages of the reveal. The image arrives fully blurred and *visible*
 * (`blurred`) before it sharpens (`sharp`) — two separate style commits, so the
 * eye reads a lens pulling into focus instead of a picture cross-fading over a
 * placeholder.
 */
export type RevealPhase = 'pending' | 'blurred' | 'sharp';

/** How long the fully blurred frame is held before it starts to sharpen (ms). */
const HOLD_MS = 130;

/**
 * Reports the reveal phase of `src` for callers that paint an image themselves
 * (the hero paints its slides as `background-image`, so it has no `<img>` to
 * hang an `onLoad` on). Jumps straight to `sharp` for an empty src, and for a
 * cached hit — nothing should blur in that the browser can already draw.
 */
export function useImageReveal(src: string | undefined | null): RevealPhase {
  const [phase, setPhase] = useState<RevealPhase>('pending');

  useEffect(() => {
    if (!src) {
      setPhase('sharp');
      return;
    }

    const img = new Image();
    let live = true;
    let hold: ReturnType<typeof setTimeout> | undefined;

    const reveal = () => {
      if (!live) return;
      setPhase('blurred');
      hold = setTimeout(() => {
        if (live) setPhase('sharp');
      }, HOLD_MS);
    };

    img.onload = reveal;
    // A broken URL resolves too — better to reveal the container's own
    // background than to shimmer forever.
    img.onerror = reveal;
    img.src = src;
    // Already decoded in the HTTP cache: skip the reveal entirely rather than
    // blurring something the browser could have painted immediately.
    if (img.complete) setPhase('sharp');

    return () => {
      live = false;
      clearTimeout(hold);
      setPhase('pending');
    };
  }, [src]);

  return phase;
}

/**
 * An `<img>` that reveals itself as a whole, blurring into focus.
 *
 * Plain `<img>` paints bytes as they arrive, so a large photo wipes down the
 * frame in bands. Here the image stays hidden behind a shimmer until it has
 * both loaded *and* decoded, then lands as one fully blurred frame and pulls
 * into focus over a longer, slower settle — so a slow connection reads as a
 * deliberate reveal rather than a half-drawn picture or an abrupt swap.
 *
 * Blur radii are written as explicit `blur-[Npx]` (never `blur-0`, which is not
 * a Tailwind v4 utility): both ends of the transition have to declare a filter
 * for the de-blur to interpolate instead of snapping.
 *
 * `className` lands on the `<img>` (sizing, `object-*`, hover transforms);
 * `wrapperClassName` lands on the positioned box the placeholder fills. The
 * transition covers `scale` too — Tailwind v4's `scale-*` utilities set the
 * `scale` property, not `transform` — so pass hover scales as bare
 * `group-hover:scale-*` and they ease in with the same curve.
 */
export function BlurImage({
  src,
  alt,
  className = '',
  wrapperClassName = 'h-full w-full',
  priority = false,
  /** Skips the shimmer where the container already carries its own tint and a
   *  moving gradient would be noise (small thumbnails). */
  shimmer = true,
}: {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  priority?: boolean;
  shimmer?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [phase, setPhase] = useState<RevealPhase>('pending');
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Two commits, two frames: the event handler paints the blurred frame, the
  // timer sharpens it. `img.decode()` would be the tidier gate but its promise
  // is deferred while the tab is hidden, which would strand images at opacity 0.
  const reveal = useCallback(() => {
    setPhase('blurred');
    clearTimeout(hold.current);
    hold.current = setTimeout(() => setPhase('sharp'), HOLD_MS);
  }, []);

  // One effect keyed on `src`: resets to the placeholder when the source
  // changes, and catches the cached case where the image completed before React
  // attached `onLoad` (which would otherwise never fire).
  useEffect(() => {
    const img = imgRef.current;
    setPhase(img?.complete && img.naturalWidth > 0 ? 'sharp' : 'pending');
    return () => clearTimeout(hold.current);
  }, [src]);

  // Resting → blurred-and-visible → sharp. `scale` overshoots slightly while
  // blurred so the blur's soft edge never exposes the placeholder beneath it.
  const stage =
    phase === 'sharp'
      ? 'opacity-100 blur-[0px] scale-100'
      : phase === 'blurred'
        ? 'opacity-100 blur-[16px] scale-[1.06]'
        : 'opacity-0 blur-[22px] scale-[1.07]';

  return (
    <span className={`relative block overflow-hidden ${wrapperClassName}`}>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,#e7e5e0_18%,#f4f3ef_38%,#e7e5e0_58%)] bg-[length:220%_100%] transition-opacity duration-[700ms] ease-out ${
          phase === 'pending'
            ? `opacity-100 ${shimmer ? 'animate-[shimmer_2s_linear_infinite]' : ''}`
            : 'opacity-0'
        }`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- remote catalogue
          URLs, no next/image remote-pattern config in this app. */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={reveal}
        onError={reveal}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        // Only hint the compositor while the reveal is actually running —
        // a grid of cards holding `will-change: filter` forever is expensive.
        style={phase === 'sharp' ? undefined : { willChange: 'filter, opacity, scale' }}
        className={`${className} [transition:opacity_320ms_ease-out,filter_900ms_cubic-bezier(0.22,0.61,0.36,1),scale_700ms_cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:[transition:opacity_320ms_ease-out] motion-reduce:blur-[0px] motion-reduce:scale-100 ${stage}`}
      />
    </span>
  );
}
