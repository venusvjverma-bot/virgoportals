import type { BasketItem } from '@/types';

export function basketLineKey(
  item: Pick<BasketItem, 'removedIngredientIds' | 'additionalRequest' | 'comboSelections'>,
): string {
  const comboKey = (item.comboSelections ?? [])
    .map((s) => `${s.groupId}:${s.dishId}:${s.servingOptionId ?? ''}`)
    .join(',');
  return `${(item.removedIngredientIds ?? []).join(',')}|${item.additionalRequest ?? ''}|${comboKey}`;
}
