import type { BasketItem } from '@/types';
import { parsePriceToMinor } from '@/lib/currency';

export function basketLineKey(
  item: Pick<BasketItem, 'removedIngredientIds' | 'additionalRequest' | 'comboSelections' | 'variantId'>,
): string {
  const comboKey = (item.comboSelections ?? [])
    .map((s) => `${s.groupId}:${s.dishId}:${s.servingOptionId ?? ''}`)
    .join(',');
  return `${(item.removedIngredientIds ?? []).join(',')}|${item.additionalRequest ?? ''}|${comboKey}|${item.variantId ?? ''}`;
}

export function unitPriceWithVariant(basePrice: string, additionalPrice: string): string {
  const baseMinor = parsePriceToMinor(basePrice) ?? 0;
  const extraMinor = parsePriceToMinor(additionalPrice) ?? 0;
  return ((baseMinor + extraMinor) / 100).toFixed(2);
}
