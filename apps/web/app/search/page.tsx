'use client';

import { Announcement } from '@/components/announcement';
import { FilterDrawer } from '@/components/filter-drawer';
import { Icon } from '@/components/icon';
import { ProductCard, type StoreProduct } from '@/components/product-card';
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

  const queryParams: Record<string, string> = { pageSize: '48' };
  if (query) queryParams.search = query;
  if (brandId) queryParams.brandId = brandId;
  if (categoryId) queryParams.categoryId = categoryId;
  const { data, isLoading, isError, refetch } = useProducts(queryParams);

  const brandName = filters?.brands.find((brand) => brand.id === brandId)?.name;
  const categoryName = filters?.categories.find((category) => category.id === categoryId)?.name;

  function removeParam(key: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.delete(key);
    const qs = next.toString();
    router.push(`/search${qs ? `?${qs}` : ''}`);
  }

  const activeFilters = [
    brandName ? { key: 'brandId', label: brandName } : null,
    categoryName ? { key: 'categoryId', label: categoryName } : null,
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
        <form className="flex max-w-[620px] border border-ink h-[48px] mb-[20px]" action="/search">
          <input
            className="min-w-0 flex-1 border-0 bg-white px-[14px] text-[13px] focus:outline focus:outline-2 focus:outline-ink focus:outline-offset-2"
            name="q"
            defaultValue={query}
            placeholder="Search products"
            aria-label="Search products"
          />
          {brandId && <input type="hidden" name="brandId" value={brandId} />}
          {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
          <button
            className="border-0 bg-ink text-white px-[19px] uppercase tracking-[.08em] text-[10px] font-bold"
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
              className="border-0 bg-[#111] text-white px-[12px] py-[9px] text-[10px] uppercase font-bold"
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
          {data?.data.map((product) => {
            const sizes = product.variants
              .filter((variant) => variant.stock > 0)
              .map((variant) => ({ id: variant.id, label: variant.size.label }))
              .slice(0, 4);
            const displayProduct: StoreProduct = {
              id: product.id,
              name: product.name,
              brand: product.brand,
              price: product.customerPrice,
              currency: product.currency,
              image: product.photoUrls[0] ?? '',
              color: product.totalStock > 0 ? `${product.totalStock} in stock` : 'Sold out',
              sizes,
            };
            return (
              <ProductCard
                key={product.id}
                isHomePage
                product={displayProduct}
                onAdd={(added) => window.location.assign(`/products/${added.id}`)}
              />
            );
          })}
        </div>
      </section>
      <FilterDrawer />
    </main>
  );
}
