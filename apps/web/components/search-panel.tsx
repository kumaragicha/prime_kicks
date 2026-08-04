'use client';

import { Icon } from '@/components/icon';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SearchPanel({ onClose, top }: { onClose: () => void; top: number }) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (cleanQuery) router.push(`/search?q=${encodeURIComponent(cleanQuery)}`);
    onClose();
  }
  return (
    <div
      style={{ top }}
      className="fixed left-0 right-0 z-[11] bg-paper border-b border-line shadow-[0_14px_24px_rgba(0,0,0,0.08)] animate-[search-drop_0.25s_cubic-bezier(0.2,0.8,0.2,1)]"
    >
      <section
        className="w-[min(760px,100%)] mx-auto pt-[25px] px-[5.25vw] pb-[28px] relative max-[800px]:pt-[20px] max-[800px]:px-[15px] max-[800px]:pb-[23px]"
        role="dialog"
        aria-label="Search products"
      >
        <button
          className="absolute right-[5.25vw] top-[16px] border-0 bg-transparent w-[31px] h-[31px] p-[7px] [&_svg]:w-[17px] max-[800px]:right-[13px] max-[800px]:top-[11px]"
          onClick={onClose}
          aria-label="Close search"
        >
          <Icon name="close" />
        </button>
        <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
          Find your next pair
        </p>
        <form
          className="border-b-2 border-ink flex items-center gap-[10px] py-[8px] px-0 [&>svg]:w-[20px]"
          onSubmit={submit}
        >
          <Icon name="search" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[19px] tracking-[-.03em] py-[7px] px-0 focus:outline-none max-[800px]:text-[15px]"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Nike, Adidas, New Balance…"
            aria-label="Search products"
          />
          <button
            className="border-0 bg-ink text-white h-[36px] py-0 px-[11px] uppercase text-[9px] tracking-[.08em] font-bold flex items-center gap-[9px] [&_svg]:w-[13px] max-[800px]:text-[8px] max-[800px]:px-[9px]"
            type="submit"
          >
            Search <Icon name="arrow" />
          </button>
        </form>
        <p className="text-[11px] text-[#777] mt-[14px] mx-0 mb-0">
          Search by product name, brand, or SKU.
        </p>
      </section>
    </div>
  );
}
