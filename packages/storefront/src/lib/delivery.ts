/** Standard delivery promise shown at checkout and on the order confirmation. */
export const DELIVERY_WINDOW = '3–5 working days';

/** `from` + `workingDays` working days, skipping Sundays (no Sunday deliveries). */
export function expectedDeliveryDate(workingDays = 5, from: Date = new Date()): Date {
  const date = new Date(from);
  let added = 0;
  while (added < workingDays) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) added += 1;
  }
  return date;
}

/** e.g. "Fri, 23 Oct, 2026". */
export function formatDeliveryDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
