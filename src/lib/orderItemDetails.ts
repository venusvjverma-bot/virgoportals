import { formatMinor } from '@/lib/currency';

export interface OrderItemAddOn {
  name: string;
  priceMinor: number;
}

interface OrderItemDetailSource {
  servingLabel: string | null;
  variantName: string | null;
  removedIngredients: string;
  addOns: OrderItemAddOn[];
}

export function orderAddOnLines(addOns: OrderItemAddOn[], currency: string): string[] {
  const groups = new Map<string, { name: string; count: number; totalMinor: number }>();
  for (const addOn of addOns) {
    const group = groups.get(addOn.name) ?? { name: addOn.name, count: 0, totalMinor: 0 };
    group.count += 1;
    group.totalMinor += addOn.priceMinor;
    groups.set(addOn.name, group);
  }
  return [...groups.values()].map(
    (group) => `+ ${group.count > 1 ? `${group.count} x ` : ''}${group.name} (${formatMinor(group.totalMinor, currency)})`,
  );
}

export function orderItemDetailLines(item: OrderItemDetailSource, currency: string): string[] {
  return [
    ...(item.servingLabel ? [`Size: ${item.servingLabel}`] : []),
    ...(item.variantName ? [`Option: ${item.variantName}`] : []),
    ...(item.removedIngredients ? [item.removedIngredients] : []),
    ...orderAddOnLines(item.addOns, currency),
  ];
}
