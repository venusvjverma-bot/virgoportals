import type { BasketComboSelection } from '@/types';

interface ComboSelectionLinesProps {
  selections: BasketComboSelection[];
}

export function ComboSelectionLines({ selections }: ComboSelectionLinesProps) {
  return (
    <ul className="mt-1 space-y-0.5">
      {selections.map((selection) => (
        <li key={`${selection.groupId}-${selection.dishId}-${selection.servingOptionId ?? ''}`} className="text-xs text-ink-muted">
          {selection.dishName}
          {selection.servingLabel ? <span className="text-ink-faint"> · {selection.servingLabel}</span> : null}
        </li>
      ))}
    </ul>
  );
}
