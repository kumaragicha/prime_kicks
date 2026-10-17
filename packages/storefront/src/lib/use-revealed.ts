'use client';

import { useEffect, useState } from 'react';

/**
 * True once `ref`'s element has come into view. Position-based (scroll + resize +
 * a slow interval) rather than IntersectionObserver, and it also flips to true on
 * its own after a few seconds — so content that starts hidden for an entrance
 * animation can never stay hidden.
 */
export function useRevealed(ref: React.RefObject<HTMLElement | null>): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) setRevealed(true);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    const timer = window.setInterval(check, 400);
    const failsafe = window.setTimeout(() => setRevealed(true), 5000);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      window.clearInterval(timer);
      window.clearTimeout(failsafe);
    };
  }, [ref]);

  return revealed;
}
