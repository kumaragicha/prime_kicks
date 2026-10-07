'use client';

import type { Product } from '@prime-kicks/types';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatedLabel } from './added-label';
import { BlurImage } from './blur-image';
import { Icon } from './icon';

export type StoreProduct = {
  id: string;
  name: string;
  brand: string;
  price: number;
  currency: 'INR';
  image: string;
  color: string;
  tags: string[];
  sizes: { id: string; label: string }[];
};

/**
 * Project a full API `Product` down to the storefront card view-model: only
 * in-stock sizes are offered, and the stock line reads "N in stock" / "Sold out".
 * Shared by the home and search grids so the mapping lives in one place.
 */
export function toStoreProduct(product: Product): StoreProduct {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    price: product.price,
    currency: product.currency,
    image: product.photoUrls[0] ?? '',
    color: product.totalStock > 0 ? `${product.totalStock} in stock` : 'Sold out',
    tags: (product.tags ?? []).filter((tag) => tag.isActive).map((tag) => tag.name),
    sizes: product.variants
      .filter((variant) => variant.stock > 0)
      .map((variant) => ({
        id: variant.id,
        label:
          product.brand === 'Crocs' ? (variant.size.conversion ?? '') : (variant.size.label ?? ''),
      })),
  };
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export function ProductCard({
  product,
  onAdd,
  priority = false,
  isHomePage = false,
  showActions = true,
}: {
  product: StoreProduct;
  /**
   * Returns whether the item was actually added — the caller resolves `true`
   * only after a successful add-to-cart (not when it defers to login or just
   * navigates), so the confirmation animation never lies. Optional: omitted for
   * the compact card (`showActions={false}`), which has no add-to-cart button.
   */
  onAdd?: (
    product: StoreProduct,
    variantId: string,
    action: 'cart' | 'book',
  ) => void | boolean | Promise<void | boolean>;
  priority?: boolean;
  isHomePage?: boolean;
  /** When false, hides the size selector + Add-to-cart/Buy-now buttons (used by
   *  the similar-products rail, which is browse-only). */
  showActions?: boolean;
}) {
  const [variantId, setVariantId] = useState('');
  const [shake, setShake] = useState(false);
  // Confirmation state for the "Add to cart" button only — Buy now just redirects.
  const [added, setAdded] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  async function handleAdd(action: 'cart' | 'book') {
    if (!onAdd) return;
    if (!variantId) {
      setShake(true);
      return;
    }
    const ok = await onAdd(product, variantId, action);
    // Only confirm a real add-to-cart; Buy now redirects, so it gets no tick.
    if (action === 'cart' && ok) {
      setAdded(true);
      clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setAdded(false), 1700);
    }
  }

  return (
    <article className="group flex h-full min-w-0 flex-col animate-[enter_0.5s_both] [&:nth-child(2n)]:[animation-delay:0.06s] [&:nth-child(3n)]:[animation-delay:0.12s]">
      <div className="relative aspect-[1/1.05] overflow-hidden bg-[#e8e6e0] rounded-[15px] shadow-[0_9px_24px_rgba(28,22,16,0.1)] max-[800px]:aspect-[1/1.16]">
        <Link
          href={`/products/${product.id}`}
          aria-label={`View ${product.name}`}
          className="block h-full w-full"
        >
          {product.image ? (
            <BlurImage
              src={product.image}
              alt={product.name}
              priority={priority}
              className="w-full h-full object-cover block group-hover:scale-[1.06]"
            />
          ) : (
            <div className="h-full grid place-items-center p-[20px] bg-[linear-gradient(145deg,#e9e7df,#cfcac0)] text-[18px] font-bold tracking-[.12em] text-center">
              {product.brand}
            </div>
          )}
        </Link>

        {product.tags.length > 0 && (
          <div className="absolute top-[10px] right-[10px] flex flex-col items-end gap-[5px] max-w-[75%] pointer-events-none">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent text-white text-[9px] font-bold uppercase tracking-[.07em] px-[9px] py-[4px] shadow-[0_3px_10px_rgba(0,0,0,0.18)] max-[800px]:text-[8px] max-[800px]:px-[7px] max-[800px]:py-[3px]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <Link
          className="absolute bottom-[10px] right-[10px] opacity-0 translate-y-[5px] transition duration-200 bg-white border-0 rounded-full px-[12px] py-[9px] text-[10px] uppercase font-bold flex gap-[6px] items-center shadow-[0_5px_16px_rgba(0,0,0,0.12)] group-hover:opacity-100 group-hover:translate-y-0 [&_svg]:w-[13px] max-[800px]:hidden"
          href={`/products/${product.id}`}
        >
          Quick view <Arrow />
        </Link>
      </div>
      <div className="flex flex-1 flex-col pt-[13px] px-[1px] pb-0">
        <div
          className={
            showActions
              ? 'flex justify-between gap-[8px] max-[800px]:block'
              : 'flex flex-col gap-[3px]'
          }
        >
          <div>
            <h3
              className={`lowercase [&::first-letter]:uppercase text-[15px] tracking-[-.035em] max-[800px]:text-[14px] ${
                showActions
                  ? isHomePage
                    ? 'leading-[1.15] overflow-hidden'
                    : 'leading-[1]'
                  : 'leading-[1.2] overflow-hidden'
              }`}
              style={
                isHomePage || !showActions
                  ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }
                  : undefined
              }
            >
              {product.brand} {product.name}
            </h3>
          </div>
          <span
            className={`flex items-baseline gap-[6px] whitespace-nowrap ${
              showActions ? 'max-[800px]:mt-[7px]' : ''
            }`}
          >
            <s className="text-[12px] text-[#9a9a9a] max-[800px]:text-[12px]">
              {formatCurrency(product.price * 2, product.currency)}
            </s>
            <strong className="text-[13px] max-[800px]:text-[13px]">
              {formatCurrency(product.price, product.currency)}
            </strong>
          </span>
        </div>

        {showActions && (
          <>
            <div
              className={`my-[10px] flex-wrap gap-[4px] flex${shake ? ' animate-shake' : ''}`}
              onAnimationEnd={() => setShake(false)}
              aria-label={`Select size for ${product.name}`}
            >
              {product.sizes.map((variant) => (
                <button
                  key={variant.id}
                  className={`w-[27px] h-[25px] rounded-[7px] text-[12px] border transition-colors duration-200 max-[800px]:w-[23px] max-[800px]:h-[23px] max-[800px]:text-[11px] ${variantId === variant.id ? 'bg-accent text-white border-accent font-bold' : 'bg-transparent border-line hover:border-ink'}`}
                  onClick={() => setVariantId(variant.id)}
                  aria-label={`Size UK ${variant.label}`}
                >
                  {variant.label}
                </button>
              ))}
            </div>
            <div className="mt-auto grid grid-cols-2 gap-[5px]">
              <button
                className={`relative overflow-hidden h-[37px] rounded-[8px] uppercase tracking-[.06em] text-[0.55rem] font-bold transition-[background-color,color,border-color,transform] duration-300 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 max-[800px]:h-[34px] border flex justify-center items-center gap-[4px] [&_svg]:w-[15px] ${
                  added
                    ? 'border-accent bg-accent text-white'
                    : 'border-ink bg-transparent hover:bg-[#e6e5e1]'
                }`}
                onClick={() => handleAdd('cart')}
                disabled={!product.sizes.length}
                aria-label="Add to cart"
              >
                <AnimatedLabel
                  done={added}
                  label="Added"
                  idle={
                    <>
                      <span className="inline-flex max-[800px]:hidden" aria-hidden="true">
                        <Icon name="bag" />
                      </span>{' '}
                      Add to cart
                    </>
                  }
                />
              </button>
              <button
                className="h-[37px] rounded-[8px] uppercase tracking-[.06em] text-[0.55rem] font-bold transition duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 max-[800px]:h-[34px] border border-accent bg-accent text-white flex justify-center gap-[4px] items-center hover:bg-[#a67f45] hover:border-[#a67f45] [&_svg]:w-[12px] max-[800px]:[&_svg]:w-[16px]"
                onClick={() => handleAdd('book')}
                disabled={!product.sizes.length}
                aria-label="Buy now"
              >
                Buy now{' '}
                <span className="inline-flex max-[800px]:hidden" aria-hidden="true">
                  <Arrow />
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
