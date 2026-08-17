'use client';

import { Announcement } from '@/components/announcement';
import { FilterDrawer } from '@/components/filter-drawer';
import { Icon } from '@/components/icon';
import { ProductCard, toStoreProduct } from '@/components/product-card';
import { SiteHeader } from '@/components/site-header';
import { useFilters, useInfiniteProductSearch } from '@/lib/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 20;

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <div className="min-h-[135px] flex items-center justify-center gap-[10px] text-[12px] text-[#666] text-center">
            <i className="w-[15px] h-[15px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
            Preparing search
          </div>
        </main>
      }
    >
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: filters } = useFilters();
  const query = params.get('q')?.trim() ?? '';
  const brandIds = params.get('brandId')?.split(',').filter(Boolean) ?? [];
  const categoryId = params.get('categoryId') ?? '';
  const tagId = params.get('tagId') ?? '';
  const size = params.get('size') ?? '';
  const brandIdKey = brandIds.join(',');

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Only the filters — paging is the hook's business. Empty values are left out
  // so that e.g. "no brand selected" and "brand param absent" share a cache key.
  const activeQuery: Record<string, string> = {};
  if (query) activeQuery.search = query;
  if (brandIdKey) activeQuery.brandId = brandIdKey;
  if (categoryId) activeQuery.categoryId = categoryId;
  if (tagId) activeQuery.tagId = tagId;
  if (size) activeQuery.size = size;

  const {
    data,
    isLoading: isInitialLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage: isLoadingMore,
  } = useInfiniteProductSearch(activeQuery, PAGE_SIZE);

  // Changing a filter changes the query key, so the accumulated list resets
  // itself — no manual reset effect, and no way to append a page twice.
  const items = data?.pages.flatMap((entry) => entry.data) ?? [];

  // Re-created whenever the guard values change, which is deliberate: an
  // observer only reports intersection *changes*, so a callback that arrives
  // mid-fetch is simply dropped. Re-observing re-delivers the current state,
  // meaning a sentinel that is already on screen when the previous page lands
  // still pulls the next one in.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: '600px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isLoadingMore, fetchNextPage]);

  const categoryName = filters?.categories.find((category) => category.id === categoryId)?.name;
  const tagName = filters?.tags?.find((tag) => tag.id === tagId)?.name;

  const [searchValue, setSearchValue] = useState(query);

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  function clearSearch() {
    setSearchValue('');
    const next = new URLSearchParams(Array.from(params.entries()));
    next.delete('q');
    const qs = next.toString();
    router.push(`/search${qs ? `?${qs}` : ''}`);
  }

  function removeParam(key: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.delete(key);
    const qs = next.toString();
    router.push(`/search${qs ? `?${qs}` : ''}`);
  }

  function removeBrand(id: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    const remaining = brandIds.filter((b) => b !== id);
    if (remaining.length > 0) {
      next.set('brandId', remaining.join(','));
    } else {
      next.delete('brandId');
    }
    const qs = next.toString();
    router.push(`/search${qs ? `?${qs}` : ''}`);
  }

  const activeFilters = [
    ...brandIds
      .map((id) => {
        const name = filters?.brands.find((brand) => brand.id === id)?.name;
        return name ? { key: `brand-${id}`, label: name, onRemove: () => removeBrand(id) } : null;
      })
      .filter(
        (entry): entry is { key: string; label: string; onRemove: () => void } => entry !== null,
      ),
    categoryName
      ? { key: 'categoryId', label: categoryName, onRemove: () => removeParam('categoryId') }
      : null,
    tagName ? { key: 'tagId', label: tagName, onRemove: () => removeParam('tagId') } : null,
    size ? { key: 'size', label: `Size ${size}`, onRemove: () => removeParam('size') } : null,
  ].filter(
    (entry): entry is { key: string; label: string; onRemove: () => void } => entry !== null,
  );

  return (
    <main className="min-h-screen">
      <Announcement />
      <SiteHeader />
      <section className="pt-[70px] max-[800px]:pt-[20px]  px-[5.25vw] pb-[100px]">
        <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
          Product search
        </p>
        <h1 className="text-[clamp(34px,5vw,62px)] tracking-[-.08em] leading-[.95] m-0 mb-[28px]">
          {query ? (
            <>
              Results for <em className="font-[Georgia,serif] font-normal">“{query}”</em>
            </>
          ) : activeFilters.length > 0 ? (
            'Filtered products'
          ) : (
            'Search products'
          )}
        </h1>
        <form
          className="flex items-center gap-[10px] max-w-[620px] h-[54px] mb-[20px] rounded-full border border-line bg-white pl-[20px] pr-[7px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-200 focus-within:border-ink focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.07)]"
          action="/search"
        >
          <span
            className="shrink-0 text-[#a29e95] [&_svg]:w-[18px] [&_svg]:h-[18px]"
            aria-hidden="true"
          >
            <Icon name="search" />
          </span>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-ink placeholder:text-[#a29e95] focus:outline-none"
            name="q"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
          />
          {searchValue && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="shrink-0 w-[26px] h-[26px] grid place-items-center rounded-full text-[#a29e95] hover:text-ink hover:bg-[#f2f0ec] transition-colors [&_svg]:w-[12px]"
            >
              <Icon name="close" />
            </button>
          )}
          {brandIdKey && <input type="hidden" name="brandId" value={brandIdKey} />}
          {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
          {tagId && <input type="hidden" name="tagId" value={tagId} />}
          {size && <input type="hidden" name="size" value={size} />}
          <button
            className="shrink-0 inline-flex h-[40px] w-[40px] items-center justify-center rounded-full bg-ink text-white transition-colors duration-200 hover:bg-[#383838] [&_svg]:w-[16px]"
            type="submit"
            aria-label="Search"
          >
            <Icon name="search" />
          </button>
        </form>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-[8px] mb-[45px]">
            <span className="text-[10px] uppercase tracking-[.12em] font-bold text-[#777] mr-[2px]">
              Filters
            </span>
            {activeFilters.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={entry.onRemove}
                className="capitalize flex items-center gap-[7px] rounded-full pl-[13px] pr-[10px] py-[7px] text-[12px] bg-accent-soft border border-accent text-ink hover:bg-accent hover:text-white transition-colors [&_svg]:w-[12px]"
                aria-label={`Remove ${entry.label} filter`}
              >
                {entry.label} <Icon name="close" />
              </button>
            ))}
          </div>
        )}
        {isInitialLoading && (
          <div className="min-h-[135px] flex items-center justify-center gap-[10px] text-[12px] text-[#666] text-center">
            <i className="w-[15px] h-[15px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
            Searching the catalogue
          </div>
        )}
        {isError && (
          <div className="min-h-[135px] flex items-center justify-center gap-[10px] text-[12px] text-[#666] text-center">
            <p>Search is unavailable right now.</p>
            <button
              className="border-0 bg-[#111] text-white rounded-[8px] px-[12px] py-[9px] text-[10px] uppercase font-bold"
              onClick={() => refetch()}
            >
              Try again
            </button>
          </div>
        )}
        {!isInitialLoading && !isError && items.length === 0 && (
          <div className="min-h-[135px] flex items-center justify-center gap-[10px] text-[12px] text-[#666] text-center">
            No products match this search. Try a different name or brand.
          </div>
        )}
        <div className="grid grid-cols-4 gap-x-[16px] gap-y-[27px] max-[800px]:grid-cols-2 max-[800px]:gap-x-[10px] max-[800px]:gap-y-[28px] min-[801px]:max-[1100px]:grid-cols-3 pt-[3px]">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              isHomePage
              product={toStoreProduct(product)}
              onAdd={(selected) => router.push(`/products/${selected.id}`)}
            />
          ))}
        </div>

        {/* Sentinel for infinite scroll — always rendered so the ref is stable.
            Once the last page is in, the effect stops observing it entirely. */}
        <div ref={sentinelRef} className="h-[1px]" />

        {isLoadingMore && (
          <div className="flex items-center justify-center gap-[10px] py-[30px] text-[12px] text-[#666] text-center">
            <i className="w-[15px] h-[15px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
            Loading more
          </div>
        )}

        {!hasNextPage && items.length > 0 && (
          <div className="py-[30px] text-center text-[11px] uppercase tracking-[.1em] text-[#999]">
            You’ve reached the end of the results
          </div>
        )}
      </section>
      <FilterDrawer />
    </main>
  );
}
