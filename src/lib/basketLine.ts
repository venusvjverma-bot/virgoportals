import type { AddOnOption, BasketItem } from '@/types';
import { parsePriceToMinor } from '@/lib/currency';

export function basketLineKey(
  item: Pick<BasketItem, 'removedIngredientIds' | 'additionalRequest' | 'comboSelections' | 'variantId' | 'addOns'>,
): string {
  const comboKey = (item.comboSelections ?? [])
    .map((s) => `${s.groupId}:${s.dishId}:${s.servingOptionId ?? ''}`)
    .join(',');
  const addOnKey = (item.addOns ?? []).map((a) => a.id).sort().join(',');
  return `${(item.removedIngredientIds ?? []).join(',')}|${item.additionalRequest ?? ''}|${comboKey}|${item.variantId ?? ''}|${addOnKey}`;
}

export function unitPriceWithExtras(basePrice: string, additionalPrice: string | null | undefined, addOns: AddOnOption[] = []): string {
  const baseMinor = parsePriceToMinor(basePrice) ?? 0;
  const extraMinor = additionalPrice ? parsePriceToMinor(additionalPrice) ?? 0 : 0;
  const addOnMinor = addOns.reduce((sum, addOn) => sum + (parsePriceToMinor(addOn.price) ?? 0), 0);
  return ((baseMinor + extraMinor + addOnMinor) / 100).toFixed(2);
}

export function groupAddOns(addOns: AddOnOption[]): { addOn: AddOnOption; count: number }[] {
  const groups = new Map<string, { addOn: AddOnOption; count: number }>();
  for (const addOn of addOns) {
    const group = groups.get(addOn.id);
    if (group) group.count += 1;
    else groups.set(addOn.id, { addOn, count: 1 });
  }
  return [...groups.values()];
}
