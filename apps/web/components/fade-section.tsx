'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Fades + lifts its children into view on scroll (once). Used to give below-the-
 * fold sections a soft entrance site-wide. The first above-the-fold block on a
 * page (hero / header) is intentionally left unwrapped so it never flashes.
 */
export function FadeSection({
  children,
  className = '',
  id,
  duration = 1.5,
  viewportAmount = 0.2,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  duration?: number;
  viewportAmount?: number;
  delay?: number;
}) {
  return (
    <motion.section
      id={id}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: viewportAmount }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.section>
  );
}

export default FadeSection;
