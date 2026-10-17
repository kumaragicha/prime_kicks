/**
 * WhatsApp review screenshots shown on the home page.
 *
 * These are served from the Cloudflare R2 bucket (public CDN domain below), not
 * from `apps/web/public/reviews/`. To add a review: upload the screenshot to the
 * `products/images/` prefix in the bucket and add its file name to `REVIEW_FILES`
 * (spaces and other unsafe characters are URL-encoded for you). Order is the
 * order shown; the section hides itself while the list is empty.
 */
const REVIEW_CDN_BASE = 'https://cdn.primekicks.in/products/images';

/** File names as uploaded to the R2 bucket root. */
const REVIEW_FILES: string[] = [
  'WhatsApp Image 2026-10-17 at 11.33.24.jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.24 (1).jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.22.jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.22 (1).jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.21.jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.21 (1).jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.20.jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.20 (1).jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.19.jpeg',
  'WhatsApp Image 2026-10-17 at 11.33.19 (1).jpeg',
  'WhatsApp Image 2026-10-17 at 11.56.48 (2).jpeg',
];

export const REVIEW_IMAGES: string[] = REVIEW_FILES.map(
  (file) => `${REVIEW_CDN_BASE}/${encodeURI(file)}`,
);
