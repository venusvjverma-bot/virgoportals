import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { categoryLabel, sectionLabel } from '@/lib/menuSections';
import { formatMinor, formatPriceInput, parsePriceToMinor } from '@/lib/currency';
import type { BasketComboSelection, Dish, DishServingOption, VisitorCombo, VisitorComboGroup } from '@/types';

const CLOSE_MS = 180;

interface ComboPick {
  dish: Dish;
  servingOption: DishServingOption | null;
}

export interface ComboSubmission {
  selections: BasketComboSelection[];
  unitMinor: number;
  quantity: number;
}

interface ComboDetailPanelProps {
  combo: VisitorCombo;
  currency: string;
  onClose: () => void;
  onAddToBasket: (submission: ComboSubmission) => void;
}

function activeOptions(dish: Dish): DishServingOption[] {
  return dish.servingOptions.filter((o) => o.isActive !== false);
}

function defaultOption(dish: Dish): DishServingOption | null {
  const options = activeOptions(dish);
  if (options.length === 0) return null;
  return options[Math.floor((options.length - 1) / 2)] ?? options[0];
}

function upgradeMinorFor(dish: Dish, option: DishServingOption | null): number {
  if (!option) return 0;
  const base = parsePriceToMinor(dish.price) ?? 0;
  const optionPrice = parsePriceToMinor(option.price) ?? base;
  return Math.max(0, optionPrice - base);
}

function toSelection(group: VisitorComboGroup, pick: ComboPick): BasketComboSelection {
  return {
    groupId: group.id,
    dishId: pick.dish.id,
    dishName: pick.dish.name,
    servingOptionId: pick.servingOption?.id ?? null,
    servingLabel: pick.servingOption?.label ?? null,
    upgradeMinor: upgradeMinorFor(pick.dish, pick.servingOption),
  };
}

export function ComboDetailPanel({ combo, currency, onClose, onAddToBasket }: ComboDetailPanelProps) {
  const [closing, setClosing] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [picks, setPicks] = useState<Record<string, ComboPick[]>>({});

  const groups = useMemo(() => combo.groups.filter((g) => g.requiredCount > 0), [combo.groups]);
  const basePriceMinor = parsePriceToMinor(combo.price) ?? 0;

  const groupComplete = (group: VisitorComboGroup) => (picks[group.id]?.length ?? 0) === group.requiredCount;
  const isComplete = groups.length > 0 && groups.every(groupComplete);

  const upgradesMinor = groups.reduce(
    (sum, group) => sum + (picks[group.id] ?? []).reduce((s, p) => s + upgradeMinorFor(p.dish, p.servingOption), 0),
    0,
  );
  const unitMinor = basePriceMinor + upgradesMinor;

  function requestClose() {
    setClosing((alreadyClosing) => {
      if (!alreadyClosing) window.setTimeout(onClose, CLOSE_MS);
      return true;
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function togglePick(group: VisitorComboGroup, dish: Dish) {
    setPicks((prev) => {
      const current = prev[group.id] ?? [];
      if (current.some((p) => p.dish.id === dish.id)) {
        return { ...prev, [group.id]: current.filter((p) => p.dish.id !== dish.id) };
      }
      const next: ComboPick[] = [...current, { dish, servingOption: defaultOption(dish) }];
      const trimmed = next.length > group.requiredCount ? next.slice(next.length - group.requiredCount) : next;
      return { ...prev, [group.id]: trimmed };
    });
  }

  function setPickSize(group: VisitorComboGroup, dishId: string, option: DishServingOption) {
    setPicks((prev) => ({
      ...prev,
      [group.id]: (prev[group.id] ?? []).map((p) => (p.dish.id === dishId ? { ...p, servingOption: option } : p)),
    }));
  }

  function handleAdd() {
    if (!isComplete) return;
    const selections = groups.flatMap((group) =>
      (picks[group.id] ?? []).map((pick) => toSelection(group, pick)),
    );
    onAddToBasket({ selections, unitMinor, quantity });
    requestClose();
  }

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-end justify-center sm:items-center', closing ? 'detail-out' : 'detail-in')}
      role="dialog"
      aria-modal="true"
      aria-label={combo.name}
    >
      <button
        type="button"
        aria-label="Close combo"
        className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]"
        onClick={requestClose}
      />

      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-cream-50 shadow-lift sm:max-w-2xl sm:rounded-3xl">
        <div className="relative h-40 shrink-0 bg-cream-100 sm:h-48">
          {combo.imageUrl ? (
            <img src={combo.imageUrl} alt={combo.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-cream-300" />
            </div>
          )}
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink shadow-soft transition-transform duration-200 hover:scale-105"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-olive-700">Combo</p>
              <h2 className="mt-1 font-display text-2xl text-ink">{combo.name}</h2>
              {combo.description ? <p className="mt-2 text-sm leading-relaxed text-ink-muted">{combo.description}</p> : null}
            </div>
            <p className="shrink-0 text-base font-semibold text-ink">{formatPriceInput(combo.price, currency)}</p>
          </div>

          {groups.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">This combo has no choices to make yet.</p>
          ) : null}

          {groups.map((group) => {
            const groupPicks = picks[group.id] ?? [];
            const done = groupComplete(group);
            return (
              <section key={group.id} className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink">
                    {sectionLabel(group.section)} · {categoryLabel(group.category)}
                  </h3>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200',
                      done ? 'bg-olive-100 text-olive-800' : 'bg-cream-200 text-ink-muted',
                    )}
                  >
                    {groupPicks.length} of {group.requiredCount} chosen
                  </span>
                </div>

                {group.dishes.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-muted">No dishes are available for this step.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {group.dishes.map((dish) => {
                      const picked = groupPicks.some((p) => p.dish.id === dish.id);
                      return (
                        <button
                          key={dish.id}
                          type="button"
                          onClick={() => togglePick(group, dish)}
                          aria-pressed={picked}
                          className={cn(
                            'group relative overflow-hidden rounded-2xl bg-white text-left shadow-soft ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift',
                            picked ? 'ring-2 ring-olive-600' : 'ring-cream-200',
                          )}
                        >
                          <div className="aspect-[4/3] w-full bg-cream-100">
                            {dish.imageUrl ? (
                              <img src={dish.imageUrl} alt={dish.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                            ) : null}
                          </div>
                          <div className="p-3">
                            <p className="truncate text-sm font-medium text-ink">{dish.name}</p>
                            <p className="text-xs text-ink-muted">{formatPriceInput(dish.price, currency)}</p>
                          </div>
                          {picked ? (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-olive-600 text-white">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                {groupPicks.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {groupPicks.map((pick) => {
                      const options = activeOptions(pick.dish);
                      return (
                        <li key={pick.dish.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-cream-200">
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{pick.dish.name}</span>
                          {options.map((option) => {
                            const active = pick.servingOption?.id === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setPickSize(group, pick.dish.id, option)}
                                aria-pressed={active}
                                className={cn(
                                  'rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200',
                                  active ? 'bg-olive-600 text-white' : 'bg-cream-100 text-ink hover:bg-cream-200',
                                )}
                              >
                                {option.label}
                                {upgradeMinorFor(pick.dish, option) > 0 ? ` +${formatMinor(upgradeMinorFor(pick.dish, option), currency)}` : ''}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => togglePick(group, pick.dish)}
                            aria-label={`Remove ${pick.dish.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-cream-100 hover:text-ink"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-cream-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2 rounded-full bg-cream-100 p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-soft transition-transform duration-200 hover:scale-105 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-semibold text-ink">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              aria-label="Increase quantity"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-soft transition-transform duration-200 hover:scale-105"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!isComplete}
            className="flex-1 rounded-full bg-olive-600 px-5 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-olive-700 disabled:cursor-not-allowed disabled:bg-cream-300 disabled:text-ink-muted"
          >
            {isComplete ? `Add combo · ${formatMinor(unitMinor * quantity, currency)}` : 'Choose every step to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
