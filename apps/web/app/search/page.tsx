'use client';

import { Announcement } from '@/components/announcement';
import { FilterDrawer } from '@/components/filter-drawer';
import { Icon } from '@/components/icon';
import { ProductCard, toStoreProduct } from '@/components/product-card';
import { SiteHeader } from '@/components/site-header';
import { useFilters, useProducts } from '@/lib/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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
  const brandId = params.get('brandId') ?? '';
  const categoryId = params.get('categoryId') ?? '';
  const tagId = params.get('tagId') ?? '';
  const size = params.get('size') ?? '';

  const queryParams: Record<string, string> = { pageSize: '48' };
  if (query) queryParams.search = query;
  if (brandId) queryParams.brandId = brandId;
  if (categoryId) queryParams.categoryId = categoryId;
  if (tagId) queryParams.tagId = tagId;
  if (size) queryParams.size = size;
  const { data, isLoading, isError, refetch } = useProducts(queryParams);

  const brandName = filters?.brands.find((brand) => brand.id === brandId)?.name;
  const categoryName = filters?.categories.find((category) => category.id === categoryId)?.name;
  const tagName = filters?.tags?.find((tag) => tag.id === tagId)?.name;

  function removeParam(key: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.delete(key);
    const qs = next.toString();
    router.push(`/search${qs ? `?${qs}` : ''}`);
  }

  const activeFilters = [
    brandName ? { key: 'brandId', label: brandName } : null,
    categoryName ? { key: 'categoryId', label: categoryName } : null,
    tagName ? { key: 'tagId', label: tagName } : null,
    size ? { key: 'size', label: `Size ${size}` } : null,
  ].filter((entry): entry is { key: string; label: string } => entry !== null);

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
          <span className="shrink-0 text-[#a29e95] [&_svg]:w-[18px] [&_svg]:h-[18px]" aria-hidden="true">
            <Icon name="search" />
          </span>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-ink placeholder:text-[#a29e95] focus:outline-none"
            name="q"
            defaultValue={query}
            placeholder="Search products"
            aria-label="Search products"
          />
          {brandId && <input type="hidden" name="brandId" value={brandId} />}
          {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
          {tagId && <input type="hidden" name="tagId" value={tagId} />}
          {size && <input type="hidden" name="size" value={size} />}
          <button
            className="shrink-0 inline-flex h-[40px] items-center gap-[8px] rounded-full bg-ink px-[24px] text-[10px] font-bold uppercase tracking-[.09em] text-white transition-colors duration-200 hover:bg-[#383838] max-[800px]:px-[18px]"
            type="submit"
          >
            Search
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
                onClick={() => removeParam(entry.key)}
                className="capitalize flex items-center gap-[7px] rounded-full pl-[13px] pr-[10px] py-[7px] text-[12px] bg-accent-soft border border-accent text-ink hover:bg-accent hover:text-white transition-colors [&_svg]:w-[12px]"
                aria-label={`Remove ${entry.label} filter`}
              >
                {entry.label} <Icon name="close" />
              </button>
            ))}
          </div>
        )}
        {isLoading && (
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
        {!isLoading && !isError && data?.data.length === 0 && (
          <div className="min-h-[135px] flex items-center justify-center gap-[10px] text-[12px] text-[#666] text-center">
            No products match this search. Try a different name or brand.
          </div>
        )}
        <div className="grid grid-cols-4 gap-x-[16px] gap-y-[27px] max-[800px]:grid-cols-2 max-[800px]:gap-x-[10px] max-[800px]:gap-y-[28px] min-[801px]:max-[1100px]:grid-cols-3 pt-[3px]">
          {data?.data.map((product) => (
            <ProductCard
              key={product.id}
              isHomePage
              product={toStoreProduct(product)}
              onAdd={(selected) => router.push(`/products/${selected.id}`)}
            />
          ))}
        </div>
      </section>
      <FilterDrawer />
    </main>
  );
}
