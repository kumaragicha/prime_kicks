'use client';

import type { ChangeEvent } from 'react';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

const btnClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * A numeric input with +/- stepper buttons.
 *
 * The input is *controlled* by a number, but when the value is `0` (or
 * `undefined`) the field renders empty — never a bare "0". This avoids the
 * classic "0" + "1" → "01" string-concatenation trap where clearing a field
 * that defaults to 0 and then typing a digit produces a leading zero.
 *
 * Users can either type freely or click the +/- buttons to remove/add.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Used for aria-labels on the stepper buttons. */
  label?: string;
}) {
  const current = value ?? 0;
  // Render empty when 0 so there's never a "0" default the user has to fight.
  const display = current === 0 ? '' : String(current);

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      // Clearing the field resets to the minimum (0 for stock, 1 for qty, etc.)
      onChange(min);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange(parsed);
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        className={fieldClass}
        value={display}
        onChange={handleInput}
        disabled={disabled}
      />
    </div>
  );
}
