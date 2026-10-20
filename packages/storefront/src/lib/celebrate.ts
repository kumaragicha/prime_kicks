/**
 * Celebration "blast" — confetti shot up from the bottom of the screen, used
 * when a coupon is applied. Brand colours, sits above the sticky checkout bar,
 * and does nothing for visitors who prefer reduced motion. The library is
 * loaded on demand so it never weighs on the initial page.
 */
const BRAND_COLORS = ['#b99255', '#171716', '#f5ecdf', '#4b7d4b', '#d9bf8c'];

export async function celebrateFromBottom(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const { default: confetti } = await import('canvas-confetti');
  const base = {
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
    gravity: 1.05,
    scalar: 0.95,
    ticks: 230,
    zIndex: 60, // above the sticky checkout bar (z-40)
  };

  // Two cannons from the bottom corners, angled inwards…
  void confetti({
    ...base,
    particleCount: 70,
    angle: 62,
    spread: 60,
    startVelocity: 58,
    origin: { x: 0, y: 1 },
  });
  void confetti({
    ...base,
    particleCount: 70,
    angle: 118,
    spread: 60,
    startVelocity: 58,
    origin: { x: 1, y: 1 },
  });
  // …then a big burst straight up from the bottom centre.
  window.setTimeout(() => {
    void confetti({
      ...base,
      particleCount: 110,
      angle: 90,
      spread: 95,
      startVelocity: 62,
      origin: { x: 0.5, y: 1.05 },
    });
  }, 180);
}
