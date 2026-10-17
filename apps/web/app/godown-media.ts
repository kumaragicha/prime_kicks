/**
 * Godown (warehouse) photos and videos shown on the home page, under reviews.
 *
 * To add one: use a full R2/CDN URL as `src` (upload to the bucket first), or
 * drop the file into `apps/web/public/godown/` and use its local path. URLs with
 * spaces or other unsafe characters must be URL-encoded (e.g. `%20`).
 *   { type: 'image', src: '/godown/shelves.jpg', caption: 'Aisle 3' }
 *   { type: 'video', src: 'https://cdn.primekicks.in/products/videos/clip.mp4', caption: 'Packing' }
 * Videos play muted on a loop while on screen and open with sound in the viewer.
 * Use MP4 (H.264) for videos so they play on every phone. Captions are optional.
 *
 * Layout repeats every 7 items (a large first tile, then smaller ones), so 7 or
 * 14 items fill the grid evenly. The section hides itself while the list is empty.
 *
 * The `dummy-*` entries are placeholders — replace them before launch.
 */
export type GodownMedia = {
  type: 'image' | 'video';
  src: string;
  poster?: string;
  caption?: string;
};

const GODOWN_IMAGE_BASE = 'https://cdn.primekicks.in/products/images';

// Videos sit on the two tall portrait slots (index 0 and 2 of the span pattern);
// the photos fill the remaining tiles.
export const GODOWN_MEDIA: GodownMedia[] = [
  {
    type: 'video',
    src: 'https://cdn.primekicks.in/products/videos/WhatsApp%20Video%202026-10-17%20at%2011.36.03.mp4',
  },
  { type: 'image', src: `${GODOWN_IMAGE_BASE}/${encodeURI('WhatsApp Image 2026-10-17 at 11.56.47 (1).jpeg')}` },
  {
    type: 'video',
    src: 'https://cdn.primekicks.in/products/videos/WhatsApp%20Video%202026-10-17%20at%2012.02.39.mp4',
  },
  { type: 'image', src: `${GODOWN_IMAGE_BASE}/${encodeURI('WhatsApp Image 2026-10-17 at 11.56.47.jpeg')}` },
  { type: 'image', src: `${GODOWN_IMAGE_BASE}/${encodeURI('WhatsApp Image 2026-10-17 at 11.56.48 (1).jpeg')}` },
  { type: 'image', src: `${GODOWN_IMAGE_BASE}/${encodeURI('WhatsApp Image 2026-10-17 at 11.56.48.jpeg')}` },
];
