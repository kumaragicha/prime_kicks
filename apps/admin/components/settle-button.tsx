import type { ButtonHTMLAttributes } from 'react';
import { CheckIcon } from './action-controls';

/**
 * The "All payment received" action button. Uses the same success (emerald)
 * tone as the payment-received action in the order tables, so the settle action
 * reads consistently across the admin — with a matching press effect.
 */
export function SettleButton({
  className = '',
  children = 'All payment received',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm transition-[background-color,transform] duration-150 hover:bg-emerald-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      <CheckIcon />
      {children}
    </button>
  );
}
