import type { BasketItem } from '@/types';

export function basketLineKey(item: Pick<BasketItem, 'removedIngredientIds' | 'additionalRequest'>): string {
  return `${(item.removedIngredientIds ?? []).join(',')}|${item.additionalRequest ?? ''}`;
}
