'use client';

import type { ReactNode } from 'react';
import { Icon } from './icon';

/**
 * Confirmation swap for an add-to-bag button. On `done`, the idle label slides
 * up and out while the confirmation (a tick that pops + draws itself, then the
 * text) slides up into place — so a press reads as a clear, on-brand success.
 *
 * The parent button must be `relative overflow-hidden` so the absolutely
 * positioned confirmation layer is clipped to the button.
 */
export function AnimatedLabel({
  done,
  idle,
  label,
}: {
  done: boolean;
  idle: ReactNode;
  label: string;
}) {
  return (
    <>
      <span
        className={`inline-flex items-center gap-[4px] transition-all duration-300 ${
          done ? 'opacity-0 -translate-y-[140%]' : 'opacity-100 translate-y-0'
        }`}
      >
        {idle}
      </span>
      <span
        aria-hidden={!done}
        className={`absolute inset-0 flex items-center justify-center gap-[6px] transition-all duration-300 ${
          done ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[140%]'
        }`}
      >
        {done && (
          <span className="inline-flex animate-check-pop [&_svg]:w-[14px] [&_path]:[stroke-dasharray:30] [&_path]:animate-check-draw">
            <Icon name="check" />
          </span>
        )}
        {label}
      </span>
    </>
  );
}
