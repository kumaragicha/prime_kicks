'use client';

import { ImageUploader } from '@/components/media-uploader';
import { controlClass } from '@/components/table-controls';
import type { HeroSlideInput } from '@/lib/api';
import { useHeroSlides, useUpdateHeroSlides } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { Button } from '@prime-kicks/ui';
import { useEffect, useState } from 'react';

const MAX_SLIDES = 4;
const EMPTY: HeroSlideInput = {
  imageUrl: '',
  mobileImageUrl: '',
  title: '',
  subtitle: '',
  ctaLabel: '',
  ctaHref: '',
};

/** Crop frames: wide banner on desktop, taller portrait on phones. */
const DESKTOP_ASPECT = 16 / 7;
const MOBILE_ASPECT = 4 / 5;

export default function HeroPage() {
  const { data, isLoading, isError } = useHeroSlides();
  const update = useUpdateHeroSlides();
  const toast = useToast();

  const [slides, setSlides] = useState<HeroSlideInput[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Seed the editable list from the server once.
  useEffect(() => {
    if (data && !loaded) {
      setSlides(
        data.map((s) => ({
          imageUrl: s.imageUrl,
          mobileImageUrl: s.mobileImageUrl ?? '',
          title: s.title,
          subtitle: s.subtitle,
          ctaLabel: s.ctaLabel,
          ctaHref: s.ctaHref,
        })),
      );
      setLoaded(true);
    }
  }, [data, loaded]);

  const patch = (index: number, next: Partial<HeroSlideInput>) =>
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...next } : s)));

  const add = () => setSlides((prev) => (prev.length < MAX_SLIDES ? [...prev, { ...EMPTY }] : prev));
  const remove = (index: number) => setSlides((prev) => prev.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) =>
    setSlides((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to]!, next[index]!];
      return next;
    });

  const save = () => {
    if (slides.some((s) => !s.imageUrl)) {
      toast.error('Every slide needs an image before saving.');
      return;
    }
    update.mutate(slides, {
      onSuccess: () => toast.success('Hero carousel updated.'),
      onError: (e: Error) => toast.error(e.message || 'Could not save the carousel.'),
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">Hero Banner</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={add} disabled={slides.length >= MAX_SLIDES}>
            + Add slide
          </Button>
          <Button onClick={save} disabled={update.isPending || slides.length === 0}>
            {update.isPending ? 'Saving…' : 'Save carousel'}
          </Button>
        </div>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Up to {MAX_SLIDES} slides rotate on the storefront homepage. Each needs an image (auto-
        optimized to WebP); title, subtitle, and button are optional. Order here is the order shown.
      </p>

      {isLoading && <p className="text-neutral-500">Loading…</p>}
      {isError && (
        <p className="text-red-600">Failed to load. This section is restricted to ADMIN accounts.</p>
      )}

      {loaded && slides.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm text-neutral-500">No slides yet.</p>
          <Button className="mt-3" variant="outline" onClick={add}>
            + Add your first slide
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {slides.map((slide, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-900">Slide {i + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                  disabled={i === slides.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ml-2 rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => remove(i)}
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Desktop image · landscape
                  </label>
                  <ImageUploader
                    value={slide.imageUrl ? [slide.imageUrl] : []}
                    max={1}
                    aspect={DESKTOP_ASPECT}
                    onChange={(urls) => patch(i, { imageUrl: urls[0] ?? '' })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Mobile image · portrait{' '}
                    <span className="font-normal normal-case text-neutral-400">
                      — optional, falls back to desktop
                    </span>
                  </label>
                  <ImageUploader
                    value={slide.mobileImageUrl ? [slide.mobileImageUrl] : []}
                    max={1}
                    aspect={MOBILE_ASPECT}
                    onChange={(urls) => patch(i, { mobileImageUrl: urls[0] ?? '' })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Title
                  </label>
                  <input
                    className={`${controlClass} w-full`}
                    value={slide.title}
                    maxLength={120}
                    placeholder="From Sole to Soul."
                    onChange={(e) => patch(i, { title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Subtitle
                  </label>
                  <input
                    className={`${controlClass} w-full`}
                    value={slide.subtitle}
                    maxLength={200}
                    placeholder="The summer edit — 2026"
                    onChange={(e) => patch(i, { subtitle: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Button label
                    </label>
                    <input
                      className={`${controlClass} w-full`}
                      value={slide.ctaLabel}
                      maxLength={40}
                      placeholder="Shop new arrivals"
                      onChange={(e) => patch(i, { ctaLabel: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Button link
                    </label>
                    <input
                      className={`${controlClass} w-full`}
                      value={slide.ctaHref}
                      maxLength={300}
                      placeholder="/search"
                      onChange={(e) => patch(i, { ctaHref: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
