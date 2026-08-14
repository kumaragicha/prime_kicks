import { z } from 'zod';

/** One hero-carousel slide as edited in the admin. */
export const heroSlideSchema = z.object({
  imageUrl: z.string().min(1, 'An image is required'),
  /** Optional portrait image for mobile; empty falls back to imageUrl. */
  mobileImageUrl: z.string().max(2048).default(''),
  title: z.string().max(120).default(''),
  subtitle: z.string().max(200).default(''),
  ctaLabel: z.string().max(40).default(''),
  ctaHref: z.string().max(300).default(''),
});

/** Replace-all payload for the hero carousel (at most four slides). */
export const heroUpdateSchema = z.object({
  slides: z.array(heroSlideSchema).max(4),
});

export type HeroSlideInput = z.infer<typeof heroSlideSchema>;
export type HeroUpdateSchema = z.infer<typeof heroUpdateSchema>;
