/**
 * Formats token counts consistently across the application.
 * The original numeric value is never changed; callers can retain exact values
 * in titles or detailed views when precision is needed.
 */
const tokenCountFormatter = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function formatTokenCount(value: number): string {
  return tokenCountFormatter.format(value);
}
