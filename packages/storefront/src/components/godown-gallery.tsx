'use client';

import { Icon } from '@/components/icon';
import { useRevealed } from '@/lib/use-revealed';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

export type GodownItem = {
  type: 'image' | 'video';
  src: string;
  poster?: string;
  caption?: string;
};

/**
 * Grid placement per tile, repeating every 7 items. Desktop is 4 columns and
 * mobile is 2 columns; tiles pack with `grid-flow-dense`. The first tile is a
 * tall portrait feature (for vertical/9:16 video), then a wide tile and smaller
 * ones. Written out in full so Tailwind sees every class.
 */
const SPANS = [
  'col-span-1 row-span-2', // 0 — tall portrait feature (vertical video)
  'col-span-1 row-span-1', // 1
  'col-span-1 row-span-2', // 2 — tall portrait feature (vertical video)
  'col-span-1 row-span-1', // 3
  'col-span-1 row-span-1', // 4
  'col-span-1 row-span-1', // 5
  'col-span-1 row-span-1', // 6
];

const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * Repeating diagonal "Prime Kicks" watermark laid over media so screenshots or
 * screen-grabs carry the brand. Decorative and never interactive.
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

function Tile({
  item,
  index,
  onOpen,
  reduceMotion,
}: {
  item: GodownItem;
  index: number;
  onOpen: (index: number) => void;
  reduceMotion: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Parallax: the picture drifts a few percent against the scroll inside a
  // slightly oversized frame, so tiles feel like windows rather than stickers.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? ['0%', '0%'] : ['-7%', '7%']);

  // Videos play only while mostly on screen — battery- and data-friendly.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [reduceMotion]);

  const isVideo = item.type === 'video';

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(index)}
      aria-label={item.caption ?? (isVideo ? 'Play godown video' : 'View godown photo')}
      initial={{ opacity: 0, y: 56, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.95, delay: (index % 4) * 0.09, ease: EASE }}
      className={`group relative block cursor-zoom-in overflow-hidden rounded-[22px] border-0 bg-[#e9e4da] p-0 shadow-[0_14px_34px_-18px_rgba(23,23,22,0.35)] focus-visible:outline-2 focus-visible:outline-ink max-[800px]:rounded-[16px] ${SPANS[index % SPANS.length]}`}
    >
      <motion.div style={{ y, scale: 1.16 }} className="absolute inset-0">
        {isVideo ? (
          <video
            ref={videoRef}
            src={item.src}
            poster={item.poster}
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            controlsList="nodownload noremoteplayback"
            onContextMenu={(event) => event.preventDefault()}
            className="pointer-events-none h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt={item.caption ?? 'Stock in our godown'}
            loading="lazy"
            decoding="async"
            draggable={false}
            onContextMenu={(event) => event.preventDefault()}
            className="pointer-events-none h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
          />
        )}
      </motion.div>

      <Watermark />

      {/* Soft bottom shade so captions stay readable on any photo. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/55 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />

      {isVideo && (
        <span className="absolute left-[12px] top-[12px] inline-flex items-center gap-[7px] rounded-full bg-black/35 px-[10px] py-[6px] text-[9px] font-bold uppercase tracking-[.14em] text-white backdrop-blur-md">
          <span className="relative flex h-[7px] w-[7px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-accent" />
          </span>
          Video
        </span>
      )}

      {item.caption && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-[6px] p-[16px] text-left text-[11px] font-bold uppercase tracking-[.12em] text-white opacity-90 transition-[transform,opacity] duration-500 group-hover:translate-y-0 group-hover:opacity-100 max-[800px]:p-[11px] max-[800px]:text-[9px]">
          {item.caption}
        </span>
      )}
    </motion.button>
  );
}

/**
 * Trust section: photos and videos from our godown, in an editorial grid with a
 * staggered reveal, scroll parallax, autoplaying (muted) videos and a viewer that
 * opens on tap (swipe / arrow keys / Escape). Renders nothing when `media` is
 * empty. Motion is dropped for visitors who prefer reduced motion.
 */
export function GodownGallery({ media }: { media: GodownItem[] }) {
  const reduceMotion = useReducedMotion() ?? false;
  const headerRef = useRef<HTMLDivElement>(null);
  const headerShown = useRevealed(headerRef);
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (delta: number) =>
      setActive((current) =>
        current === null ? null : (current + delta + media.length) % media.length,
      ),
    [media.length],
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

  if (media.length === 0) return null;

  const current = active === null ? null : media[active];

  return (
    <section
      id="godown"
      className="scroll-mt-[92px] px-[5.25vw] pt-[42px] pb-[24px] max-[800px]:scroll-mt-[76px] max-[800px]:px-[15px] max-[800px]:pt-[28px] max-[800px]:pb-[14px]"
    >
      {/* Same format as the reviews heading: gold label, headline with an italic
          accent word, and a quiet hint on the right. */}
      <motion.div
        ref={headerRef}
        className="mb-[27px] max-[800px]:mb-[20px]"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={headerShown || reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <p className="m-0 mb-[12px] flex items-center gap-[10px] text-[10px] font-bold uppercase tracking-[.16em] text-accent">
          <span aria-hidden="true" className="h-px w-[28px] bg-accent" />
          Behind Prime Kicks
        </p>
        <div className="flex items-end justify-between gap-[16px]">
          <h2 className="m-0 text-[38px] leading-[.9] tracking-[-.07em] max-[800px]:text-[31px]">
            Where every pair <em className="font-[Georgia,serif] font-normal">begins.</em>
          </h2>
          <span className="shrink-0 pb-[4px] text-[10px] font-bold uppercase tracking-[.14em] text-[#a7a29a] max-[800px]:hidden">
            Tap to view →
          </span>
        </div>
      </motion.div>

      <div className="grid grid-flow-dense auto-rows-[150px] grid-cols-2 gap-[10px] min-[801px]:auto-rows-[210px] min-[801px]:grid-cols-4 min-[801px]:gap-[16px]">
        {media.map((item, index) => (
          <Tile
            key={`${item.src}-${index}`}
            item={item}
            index={index}
            onOpen={setActive}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>

      <AnimatePresence>
        {current && active !== null && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(12,12,11,0.9)] px-[16px] backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="Godown gallery"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-[18px] top-[18px] z-[2] grid h-[42px] w-[42px] place-items-center rounded-full border-0 bg-white/10 text-white backdrop-blur [&_svg]:h-[20px] [&_svg]:w-[20px]"
            >
              <Icon name="close" />
            </button>

            {media.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    step(-1);
                  }}
                  aria-label="Previous"
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
                  aria-label="Next"
                  className="absolute right-[14px] top-1/2 z-[2] grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-full border-0 bg-white/10 text-white backdrop-blur max-[800px]:hidden [&_svg]:h-[20px] [&_svg]:w-[20px]"
                >
                  <Icon name="arrow" />
                </button>
              </>
            )}

            <AnimatePresence mode="wait">
              <motion.figure
                key={active}
                className="m-0 flex max-h-[86vh] max-w-[min(94vw,1100px)] flex-col items-center gap-[12px]"
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: EASE }}
                // Swipe left/right on a phone to move between items.
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -70 || info.velocity.x < -500) step(1);
                  else if (info.offset.x > 70 || info.velocity.x > 500) step(-1);
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="relative flex w-fit max-w-full overflow-hidden rounded-[18px]">
                  {current.type === 'video' ? (
                    <video
                      src={current.src}
                      poster={current.poster}
                      controls
                      autoPlay
                      loop
                      playsInline
                      disablePictureInPicture
                      controlsList="nodownload noremoteplayback noplaybackrate"
                      onContextMenu={(event) => event.preventDefault()}
                      className="max-h-[78vh] w-auto max-w-full bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={current.src}
                      alt={current.caption ?? 'Stock in our godown'}
                      draggable={false}
                      onContextMenu={(event) => event.preventDefault()}
                      className="max-h-[78vh] w-auto max-w-full bg-white object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
                    />
                  )}
                  <Watermark />
                </div>
                {current.caption && (
                  <figcaption className="text-[11px] font-bold uppercase tracking-[.14em] text-white/80">
                    {current.caption}
                  </figcaption>
                )}
              </motion.figure>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
