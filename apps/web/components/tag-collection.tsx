'use client';

import { FadeSection } from '@/components/fade-section';
import { Icon } from '@/components/icon';
import { ProductCard, toStoreProduct, type StoreProduct } from '@/components/product-card';
import { useFilters, useProducts } from '@/lib/hooks';
import Link from 'next/link';
import { useMemo } from 'react';

/** Add-to-cart handler shape shared with {@link ProductCard}. */
export type AddHandler = (
  product: StoreProduct,
  variantId: string,
  action: 'cart' | 'book',
) => void | boolean | Promise<void | boolean>;

/**
 * A curated storefront row backed by a single merchandising tag (e.g. "New
 * Arrivals", "Hot Selling"). Pass the tag name through props — this is the one
 * place the "products carrying tag X" collection is rendered, so any page that
 * wants such a row reuses it rather than re-implementing the fetch + grid.
 *
 * Fetches up to `limit` products carrying the tag and hides the whole section
 * when the tag has no products, so the page never shows an empty block.
 */
export function TagCollection({
  title,
  tag,
  onAdd,
  priority = false,
  limit = 4,
  id,
}: {
  /** Heading shown above the row. Defaults to the tag name. */
  title?: string;
  /** Tag name to fetch by (matched case-insensitively on the API). */
  tag: string;
  onAdd: AddHandler;
  /** Eager-load the card images (use for the first, above-the-fold row). */
  priority?: boolean;
  /** Max cards to show. */
  limit?: number;
  id?: string;
}) {
  const { data, isLoading, isError, refetch } = useProducts({ tag, pageSize: String(limit) });
  const { data: filters } = useFilters();
  const products = useMemo<StoreProduct[]>(() => data?.data.map(toStoreProduct) ?? [], [data]);

  // "View all" reuses the search + filter path, keyed on the tag's id.
  const tagId = filters?.tags?.find((entry) => entry.name === tag)?.id;
  const viewAllHref = tagId ? `/search?tagId=${tagId}` : '/search';

  // Nothing to show and nothing pending — drop the section entirely.
  if (!isLoading && !isError && products.length === 0) return null;

  return (
    <FadeSection
      className="scroll-mt-[92px] pt-[42px] px-[5.25vw] pb-[24px] max-[800px]:scroll-mt-[76px] max-[800px]:pt-[28px] max-[800px]:px-[15px] max-[800px]:pb-[14px]"
      id={id}
    >
      <div className="flex items-center justify-between gap-[16px] mb-[27px]">
        <h2 className="text-[38px] tracking-[-.07em] m-0 leading-[.9] max-[800px]:text-[31px]">
          {title ?? tag}
        </h2>
        {products.length > 0 && (
          <Link
            href={viewAllHref}
            className="shrink-0 text-white bg-ink border border-[rgba(255,255,255,0.3)] rounded-[8px] no-underline uppercase text-[11px] font-bold tracking-[.09em] py-[11px] px-[15px] inline-flex gap-[16px] items-center transition-[transform,background] duration-200 hover:translate-x-[5px] hover:bg-[#31302d] [&_svg]:w-[16px] [&_svg]:h-[16px] max-[800px]:hidden"
          >
            View all <Icon name="arrow" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-4 gap-x-[16px] gap-y-[27px] max-[800px]:grid-cols-2 max-[800px]:gap-x-[10px] max-[800px]:gap-y-[28px] min-[801px]:max-[1100px]:grid-cols-3">
        {products.slice(0, limit).map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            onAdd={onAdd}
            priority={priority && index < limit}
            isHomePage
          />
        ))}
        {isLoading &&
          Array.from({ length: limit }, (_, index) => <ProductSkeleton key={index} />)}
      </div>

      {/* Mobile: "View all" sits below the cards, centered — no scrolling back
          up to the heading. Hidden on desktop where the header button is used. */}
      {products.length > 0 && (
        <div className="hidden justify-center pt-[22px] max-[800px]:flex">
          <Link
            href={viewAllHref}
            className="text-white bg-ink border border-[rgba(255,255,255,0.3)] rounded-[8px] no-underline uppercase text-[11px] font-bold tracking-[.09em] py-[12px] px-[20px] inline-flex gap-[16px] items-center transition-[transform,background] duration-200 hover:bg-[#31302d] [&_svg]:w-[16px] [&_svg]:h-[16px]"
          >
            View all <Icon name="arrow" />
          </Link>
        </div>
      )}
      {isError && (
        <div className="text-center text-[13px] text-[#666] pt-[40px] px-0 pb-[70px]">
          <p>{`We couldn't load this section. Check that the product API is running.`}</p>
          <button
            className="border-0 bg-ink text-white rounded-[8px] py-[11px] px-[14px] mt-[6px] text-[10px] font-bold uppercase tracking-[.08em] inline-flex items-center gap-[12px] [&_svg]:w-[13px]"
            onClick={() => refetch()}
          >
            Try again <Icon name="arrow" />
          </button>
        </div>
      )}
    </FadeSection>
  );
}

function ProductSkeleton() {
  return (
    <div className="min-w-0" aria-hidden="true">
      <div className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] aspect-[1/1.05]" />
      <p className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] w-[55%] h-[11px] mt-[14px] mx-0 mb-0" />
      <p className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] w-[82%] h-[11px] mt-[8px] mx-0 mb-0" />
      <span className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] block w-[45%] h-[10px] mt-[10px]" />
      <section className="bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] grid grid-cols-2 gap-[5px] mt-[13px]">
        <i className="h-[37px]" />
        <i className="h-[37px]" />
      </section>
    </div>
  );
}
