'use client';

import { FadeSection } from '@/components/fade-section';
import { Icon } from '@/components/icon';
import { brandInitials, brandLogoSvg } from '@/lib/brand-logos';
import { useFilters } from '@/lib/hooks';
import type { FilterOption } from '@/lib/api';
import Link from 'next/link';

/**
 * "Shop by brand" — every active brand, as a horizontally scrolling row of logo
 * tiles that deep-link into the search page's brand filter.
 *
 * Brands come from the same `useFilters()` query the filter drawer already uses,
 * so this section adds no request of its own (react-query dedupes the shared
 * `['filters']` key). Logos are mapped frontend-side — see `lib/brand-logos`.
 */
export function BrandCollection({ id }: { id?: string }) {
  const { data: filters, isLoading } = useFilters();
  const brands = filters?.brands ?? [];

  // Nothing to show and nothing pending — drop the section entirely, matching
  // how TagCollection hides an empty row.
  if (!isLoading && brands.length === 0) return null;

  return (
    <FadeSection
      className="scroll-mt-[92px] pt-[42px] px-[5.25vw] pb-[10px] max-[800px]:scroll-mt-[76px] max-[800px]:pt-[28px] max-[800px]:px-[15px] max-[800px]:pb-[6px]"
      id={id}
    >
      <div className="flex items-center justify-between gap-[16px] mb-[27px] max-[800px]:mb-[20px]">
        <h2 className="text-[38px] tracking-[-.07em] m-0 leading-[.9] max-[800px]:text-[31px]">
          Shop by brand
        </h2>
        {/* Same "View all" treatment as the tag collections: a dark pill beside
            the heading on desktop, swapped for the rule below the row on mobile. */}
        {brands.length > 0 && (
          <Link
            href="/search"
            className="shrink-0 text-white bg-ink border border-[rgba(255,255,255,0.3)] rounded-[8px] no-underline uppercase text-[11px] font-bold tracking-[.09em] py-[11px] px-[15px] inline-flex gap-[16px] items-center transition-[transform,background] duration-200 hover:translate-x-[5px] hover:bg-[#31302d] [&_svg]:w-[16px] [&_svg]:h-[16px] max-[800px]:hidden"
          >
            View all <Icon name="arrow" />
          </Link>
        )}
      </div>

      {/* The row bleeds to the viewport edge (negative margin cancels the
          section padding) so a partially visible tile signals it scrolls, while
          the first tile still lines up with the heading above it.
          `overflow-x` clips the cross axis too, so the vertical padding is what
          keeps a hovered tile's lift and shadow from being cut off. */}
      <div
        className="flex gap-[26px] overflow-x-auto snap-x scroll-px-[5.25vw] px-[5.25vw] -mx-[5.25vw] pt-[8px] -mt-[8px] pb-[14px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[800px]:gap-[18px] max-[800px]:px-[15px] max-[800px]:-mx-[15px] max-[800px]:scroll-px-[15px]"
        role="list"
      >
        {brands.map((brand) => (
          <BrandTile key={brand.id} brand={brand} />
        ))}
        {isLoading &&
          brands.length === 0 &&
          Array.from({ length: 6 }, (_, index) => <BrandSkeleton key={index} />)}
      </div>

      {/* Mobile: "View all" sits on a hairline rule below the row — matching the
          tag collections, so both sections end the same way. */}
      {brands.length > 0 && (
        <div className="hidden items-center gap-[14px] pt-[18px] max-[800px]:flex">
          <span className="h-px flex-1 bg-line" />
          <Link
            href="/search"
            className="inline-flex shrink-0 items-center gap-[9px] whitespace-nowrap uppercase no-underline text-[12px] font-bold tracking-[.08em] text-ink transition-opacity duration-200 hover:opacity-60 [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:text-accent"
          >
            View all <Icon name="arrow" />
          </Link>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
    </FadeSection>
  );
}

function BrandTile({ brand }: { brand: FilterOption }) {
  // A brand missing from BRAND_LOGOS still gets a tile — it falls back to the
  // initials treatment, so the row lists everything the catalogue carries.
  const logo = brandLogoSvg(brand.name);

  return (
    <Link
      href={`/search?brandId=${brand.id}`}
      role="listitem"
      className="group shrink-0 snap-start w-[84px] no-underline text-ink max-[800px]:w-[68px]"
      aria-label={`Shop ${brand.name}`}
    >
      <div className="relative aspect-square overflow-hidden rounded-full border border-line bg-[#f7f6f3] grid place-items-center transition-[border-color,transform,box-shadow,background-color] duration-200 group-hover:border-ink/25 group-hover:bg-white group-hover:-translate-y-[2px] group-hover:shadow-[0_6px_16px_rgba(28,22,16,0.09)]">
        {logo ? (
          // Static markup from BRAND_LOGOS — authored in this repo, never user
          // input — so there is nothing to sanitise here.
          <span
            aria-hidden="true"
            className="w-full h-full p-[17px] block text-ink/45 transition-[transform,color] duration-[600ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.06] group-hover:text-ink [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain max-[800px]:p-[14px]"
            dangerouslySetInnerHTML={{ __html: logo }}
          />
        ) : (
          <span className="text-[17px] font-[900] tracking-[-.03em] text-ink/40 transition-colors duration-200 group-hover:text-ink/75 max-[800px]:text-[15px]">
            {brandInitials(brand.name)}
          </span>
        )}
      </div>
      <p className="mt-[10px] text-center text-[10px] font-bold uppercase tracking-[.07em] text-ink/60 truncate transition-colors duration-200 group-hover:text-ink max-[800px]:text-[9px] max-[800px]:mt-[8px]">
        {brand.name}
      </p>
    </Link>
  );
}

function BrandSkeleton() {
  return (
    <div className="shrink-0 w-[84px] max-[800px]:w-[68px]" aria-hidden="true">
      <div className="aspect-square rounded-full bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite]" />
      <p className="mx-auto mt-[10px] h-[9px] w-[62%] bg-[linear-gradient(90deg,#e6e4df_20%,#f1f0ec_50%,#e6e4df_80%)] bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite]" />
    </div>
  );
}
