'use client';

import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useState } from 'react';
import { Icon } from './icon';

export type StoreProduct = {
  id: string;
  name: string;
  brand: string;
  price: number;
  currency: 'INR';
  image: string;
  color: string;
  sizes: { id: string; label: string }[];
};

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
}: {
  product: StoreProduct;
  onAdd: (product: StoreProduct, variantId: string, action: 'cart' | 'book') => void;
  priority?: boolean;
}) {
  const [variantId, setVariantId] = useState('');
  const [shake, setShake] = useState(false);

  function handleAdd(action: 'cart' | 'book') {
    if (!variantId) {
      setShake(true);
      return;
    }
    onAdd(product, variantId, action);
  }

  return (
    <article className="group min-w-0 animate-[enter_0.5s_both] [&:nth-child(2n)]:[animation-delay:0.06s] [&:nth-child(3n)]:[animation-delay:0.12s]">
      <div className="relative aspect-[1/1.05] overflow-hidden bg-[#e8e6e0] rounded-[15px] shadow-[0_9px_24px_rgba(28,22,16,0.1)] max-[800px]:aspect-[1/1.16]">
        <Link href={`/products/${product.id}`} aria-label={`View ${product.name}`}>
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              className="w-full h-full object-cover block transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.06]"
            />
          ) : (
            <div className="h-full grid place-items-center p-[20px] bg-[linear-gradient(145deg,#e9e7df,#cfcac0)] text-[18px] font-bold tracking-[.12em] text-center">
              {product.brand}
            </div>
          )}
        </Link>

        <Link
          className="absolute bottom-[10px] right-[10px] opacity-0 translate-y-[5px] transition duration-200 bg-white border-0 rounded-full px-[12px] py-[9px] text-[10px] uppercase font-bold flex gap-[6px] items-center shadow-[0_5px_16px_rgba(0,0,0,0.12)] group-hover:opacity-100 group-hover:translate-y-0 [&_svg]:w-[13px] max-[800px]:hidden"
          href={`/products/${product.id}`}
        >
          Quick view <Arrow />
        </Link>
      </div>
      <div className="pt-[13px] px-[1px] pb-0">
        <div className="flex justify-between gap-[8px] max-[800px]:block">
          <div>
            <h3 className="text-[15px] tracking-[-.035em] leading-[1] max-[800px]:text-[14px]">
              {product.brand} {product.name}
            </h3>
          </div>
          <strong className="text-[13px] whitespace-nowrap max-[800px]:block max-[800px]:mt-[7px] max-[800px]:text-[13px]">
            {formatCurrency(product.price, product.currency)}
          </strong>
        </div>

        <div
          className={`my-[10px] gap-[4px] flex${shake ? ' animate-shake' : ''}`}
          onAnimationEnd={() => setShake(false)}
          aria-label={`Select size for ${product.name}`}
        >
          {product.sizes.map((variant) => (
            <button
              key={variant.id}
              className={`w-[27px] h-[25px] rounded-[7px] text-[10px] border transition-colors duration-200 max-[800px]:w-[23px] max-[800px]:h-[23px] max-[800px]:text-[9px] ${variantId === variant.id ? 'bg-accent text-white border-accent font-bold' : 'bg-transparent border-line hover:border-ink'}`}
              onClick={() => setVariantId(variant.id)}
              aria-label={`Size UK ${variant.label}`}
            >
              {variant.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-[5px]">
          <button
            className="h-[37px] rounded-[8px] uppercase tracking-[.06em] text-[9px] font-bold transition duration-200 disabled:cursor-not-allowed disabled:opacity-40 max-[800px]:h-[34px] border border-ink bg-transparent hover:bg-[#e6e5e1] flex justify-center items-center gap-[4px] [&_svg]:w-[15px]"
            onClick={() => handleAdd('cart')}
            disabled={!product.sizes.length}
            aria-label="Add to cart"
          >
            <span className="inline-flex max-[800px]:hidden" aria-hidden="true">
              <Icon name="bag" />
            </span>{' '}
            Add to cart
          </button>
          <button
            className="h-[37px] rounded-[8px] uppercase tracking-[.06em] text-[9px] font-bold transition duration-200 disabled:cursor-not-allowed disabled:opacity-40 max-[800px]:h-[34px] border border-ink bg-ink text-white flex justify-center gap-[4px] items-center hover:bg-[#383838] [&_svg]:w-[12px] max-[800px]:[&_svg]:w-[16px]"
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
      </div>
    </article>
  );
}
