import type { TipOption } from '@/types';

export const TIP_OPTIONS: { option: TipOption; label: string; percent: number | null }[] = [
  { option: '5', label: '5%', percent: 5 },
  { option: '10', label: '10%', percent: 10 },
  { option: '13', label: '13%', percent: 13 },
  { option: '20', label: '20%', percent: 20 },
  { option: 'custom', label: 'Custom', percent: null },
  { option: 'none', label: 'No tip', percent: null },
];

export function computeTipMinor(option: TipOption, customMinor: number, subtotalMinor: number): number {
  if (option === 'custom') return customMinor;
  const percent = TIP_OPTIONS.find((o) => o.option === option)?.percent;
  if (percent === null || percent === undefined) return 0;
  return Math.round((subtotalMinor * percent) / 100);
}
