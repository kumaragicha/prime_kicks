'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icon';
import { useFilters } from '@/lib/hooks';

/** EU shoe sizes offered as filter chips (36–45). */
const EU_SIZES = Array.from({ length: 10 }, (_, i) => String(36 + i));

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`capitalize rounded-full px-[15px] py-[9px] text-[12px] border transition-colors duration-200 ${
        selected
          ? 'bg-accent text-white border-accent font-bold'
          : 'bg-transparent border-line text-ink hover:border-ink'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Storefront facet filter. A floating pill (bottom-right on every viewport) opens a
 * drawer — a right-hand panel on desktop, a bottom sheet on mobile. Applying pushes the
 * chosen brand/category to the search page as query params.
 */
export function FilterDrawer() {
  const { data, isLoading } = useFilters();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagId, setTagId] = useState('');
  const [size, setSize] = useState('');

  // Pill badge reflects the filters currently in the URL. Derived from
  // useSearchParams so it re-renders on every navigation — applying filters
  // from the drawer AND removing a chip on the search page both update it live.
  const searchParams = useSearchParams();
  const appliedCount = (['brandId', 'categoryId', 'tagId', 'size'] as const).filter((key) =>
    searchParams.get(key),
  ).length;

  // Open from other triggers (e.g. the "Fresh drops" header button) via a shared event.
  useEffect(() => {
    const handler = () => openDrawer();
    window.addEventListener('pk:open-filters', handler);
    return () => window.removeEventListener('pk:open-filters', handler);
  }, []);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function openDrawer() {
    const params = new URLSearchParams(window.location.search);
    setBrandId(params.get('brandId') ?? '');
    setCategoryId(params.get('categoryId') ?? '');
    setTagId(params.get('tagId') ?? '');
    setSize(params.get('size') ?? '');
    setOpen(true);
  }

  function clearAll() {
    setBrandId('');
    setCategoryId('');
    setTagId('');
    setSize('');
  }

  function apply() {
    const params = new URLSearchParams();
    const existingQuery = new URLSearchParams(window.location.search).get('q');
    if (existingQuery) params.set('q', existingQuery);
    if (brandId) params.set('brandId', brandId);
    if (categoryId) params.set('categoryId', categoryId);
    if (tagId) params.set('tagId', tagId);
    if (size) params.set('size', size);
    const qs = params.toString();
    setOpen(false);
    router.push(`/search${qs ? `?${qs}` : ''}`);
  }

  const selectedCount = (brandId ? 1 : 0) + (categoryId ? 1 : 0) + (tagId ? 1 : 0) + (size ? 1 : 0);

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        aria-label="Open filters"
        className="fixed bottom-[24px] right-[24px] z-30 flex items-center gap-[9px] bg-accent text-ink rounded-full pl-[18px] pr-[20px] py-[14px] shadow-[0_12px_30px_rgba(0,0,0,0.28)] text-[11px] uppercase tracking-[.08em] font-bold [&_svg]:w-[15px] transition-transform duration-200 hover:-translate-y-[2px] max-[800px]:bottom-[18px] max-[800px]:right-[18px]"
      >
        <Icon name="filter" /> Filters
        {appliedCount > 0 && (
          <span className="grid place-items-center min-w-[18px] h-[18px] px-[5px] rounded-full bg-ink text-white text-[9px] font-bold">
            {appliedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Filters">
          <div
            className="absolute inset-0 bg-[rgba(10,10,10,0.44)] animate-fade"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bg-paper flex flex-col shadow-[0_20px_60px_#0004] right-0 top-0 h-full w-[420px] animate-slide-in-right max-[800px]:left-0 max-[800px]:top-auto max-[800px]:bottom-0 max-[800px]:w-full max-[800px]:h-auto max-[800px]:max-h-[85vh] max-[800px]:rounded-t-[20px] max-[800px]:animate-drawer">
            <div className="flex items-center justify-between px-[24px] py-[20px] border-b border-line">
              <div>
                <p className="text-[10px] uppercase tracking-[.16em] font-bold text-accent m-0 mb-[4px]">
                  Refine
                </p>
                <h2 className="text-[22px] tracking-[-.04em] font-bold m-0 leading-none">Filters</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="w-[36px] h-[36px] grid place-items-center border border-line rounded-full [&_svg]:w-[16px] hover:border-ink transition-colors"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-[24px] py-[24px] grid gap-[28px] content-start">
              {isLoading && <p className="text-[12px] text-[#777]">Loading filters…</p>}

              {data && data.brands.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[.12em] font-bold text-[#777] m-0 mb-[13px]">
                    Brand
                  </p>
                  <div className="flex flex-wrap gap-[8px]">
                    {data.brands.map((brand) => (
                      <Chip
                        key={brand.id}
                        label={brand.name}
                        selected={brandId === brand.id}
                        onClick={() => setBrandId(brandId === brand.id ? '' : brand.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {data && data.categories.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[.12em] font-bold text-[#777] m-0 mb-[13px]">
                    Category
                  </p>
                  <div className="flex flex-wrap gap-[8px]">
                    {data.categories.map((category) => (
                      <Chip
                        key={category.id}
                        label={category.name}
                        selected={categoryId === category.id}
                        onClick={() => setCategoryId(categoryId === category.id ? '' : category.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {data && data.tags?.length > 0 && (
                <section>
                  <p className="text-[10px] uppercase tracking-[.12em] font-bold text-[#777] m-0 mb-[13px]">
                    Tag
                  </p>
                  <div className="flex flex-wrap gap-[8px]">
                    {data.tags.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        selected={tagId === tag.id}
                        onClick={() => setTagId(tagId === tag.id ? '' : tag.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="text-[10px] uppercase tracking-[.12em] font-bold text-[#777] m-0 mb-[13px]">
                  Size (EU)
                </p>
                <div className="flex flex-wrap gap-[8px]">
                  {EU_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(size === s ? '' : s)}
                      aria-pressed={size === s}
                      className={`grid place-items-center min-w-[46px] h-[42px] rounded-[10px] px-[10px] text-[13px] border transition-colors duration-200 ${
                        size === s
                          ? 'bg-accent text-white border-accent font-bold'
                          : 'bg-transparent border-line text-ink hover:border-ink'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>

              {data &&
                data.brands.length === 0 &&
                data.categories.length === 0 &&
                !data.tags?.length && (
                  <p className="text-[12px] text-[#777]">No filters available right now.</p>
                )}
            </div>

            <div className="border-t border-line px-[24px] py-[18px] flex items-center gap-[12px]">
              <button
                type="button"
                onClick={clearAll}
                disabled={selectedCount === 0}
                className="text-[11px] uppercase tracking-[.08em] font-bold text-ink underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={apply}
                className="ml-auto flex items-center gap-[10px] bg-ink text-white rounded-[10px] h-[46px] px-[26px] text-[11px] uppercase tracking-[.08em] font-bold [&_svg]:w-[15px] hover:bg-[#31302d] transition-colors"
              >
                Show results <Icon name="arrow" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
