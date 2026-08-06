import type { HeroSlide } from '@/lib/api';
import { HomeClient } from './home-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/**
 * Fetch the hero-carousel slides on the server so the banner image and copy
 * ship in the first HTML the visitor sees. Never throws — a failed/absent API
 * just yields the static fallback hero on the client.
 */
async function fetchHeroSlides(): Promise<HeroSlide[]> {
  try {
    const res = await fetch(`${API_URL}/hero`, { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json()) as HeroSlide[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const heroSlides = await fetchHeroSlides();
  return <HomeClient initialHeroSlides={heroSlides} />;
}
