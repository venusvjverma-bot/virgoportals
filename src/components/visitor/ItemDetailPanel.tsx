import { useEffect, useState, type ReactNode } from 'react';
import { Minus, Plus, UtensilsCrossed, X, ShoppingBag, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { categoryLabel, sectionLabel } from '@/lib/menuSections';
import { formatPriceInput } from '@/lib/currency';
import type { Dish, DishServingOption, DishRemovableIngredient } from '@/types';

const CLOSE_MS = 180;

interface ItemDetailPanelProps {
  dish: Dish;
  currency: string;
  onClose: () => void;
  onAddToBasket: (dish: Dish, quantity: number, servingOption?: DishServingOption | null, removedIngredientIds?: string[], removedIngredientLabels?: string[]) => void;
}

function defaultServingOptionIndex(options: DishServingOption[]): number {
  if (options.length === 0) return -1;
  if (options.length === 1) return 0;
  if (options.length % 2 === 1) {
    return Math.floor(options.length / 2);
  }
  return options.length - 2;
}

export function ItemDetailPanel({ dish, currency, onClose, onAddToBasket }: ItemDetailPanelProps) {
  const [closing, setClosing] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const activeOptions = dish.servingOptions?.filter((o) => o.isActive !== false) ?? [];
  const hasOptions = activeOptions.length > 0;
  const defaultIdx = defaultServingOptionIndex(activeOptions);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    defaultIdx >= 0 ? activeOptions[defaultIdx].id : null
  );

  const activeRemovableIngredients = (dish.removableIngredients ?? []).filter((i) => i.isActive !== false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const selectedOption = hasOptions
    ? activeOptions.find((o) => o.id === selectedOptionId) ?? activeOptions[defaultIdx] ?? null
    : null;

  const displayPrice = selectedOption ? selectedOption.price : dish.price;
  const formattedPrice = displayPrice ? formatPriceInput(displayPrice, currency) : '';

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

  function handleAdd() {
    const selectedIds = [...removedIds];
    const selectedLabels = activeRemovableIngredients
      .filter((i) => removedIds.has(i.id))
      .map((i) => i.label);
    onAddToBasket(dish, quantity, selectedOption ?? null, selectedIds, selectedLabels);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center sm:items-center',
        closing ? 'detail-out' : 'detail-in'
      )}
      role="dialog"
      aria-modal="true"
      aria-label={dish.name}
    >
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]"
        onClick={requestClose}
      />

      <div
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-cream-50 shadow-lift',
          'rounded-t-3xl sm:max-h-[88dvh] sm:max-w-lg sm:rounded-3xl'
        )}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close details"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-olive-500"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft">
          {dish.imageUrl ? (
            <img
              src={dish.imageUrl}
              alt={dish.name}
              className="mx-auto h-72 w-full bg-cream-100 object-contain sm:h-80"
            />
          ) : (
            <div className="flex h-40 w-full items-center justify-center bg-cream-100 text-olive-500 sm:h-48">
              <span className="flex flex-col items-center gap-2">
                <UtensilsCrossed className="h-8 w-8" />
                <span className="text-xs text-ink-faint">No image</span>
              </span>
            </div>
          )}

          <div className="px-5 pb-6 pt-5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 font-display text-xl font-semibold tracking-tight text-ink">
                {dish.name || 'Untitled item'}
              </h2>
              {formattedPrice ? (
                <span className="shrink-0 font-display text-lg font-semibold text-olive-700">
                  {formattedPrice}
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-olive-100 px-2.5 py-1 text-xs font-medium text-olive-700">
                {sectionLabel(dish.section)}
              </span>
              <span className="inline-flex items-center rounded-full bg-olive-100 px-2.5 py-1 text-xs font-medium text-olive-700">
                {categoryLabel(dish.category)}
              </span>
            </div>

            {dish.description ? (
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">{dish.description}</p>
            ) : null}

            <div className="mt-5 space-y-4">
              <DetailRow label="Ingredients" value={dish.ingredients} />
              {!hasOptions ? <DetailRow label="Serving size" value={dish.serving} /> : null}
              <DetailRow label="Alcohol" value={dish.abv} />
              {dish.allergy.trim() ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Allergens
                  </p>
                  <p className="mt-1 inline-flex rounded-lg bg-warning-50 px-2.5 py-1 text-sm font-medium leading-relaxed text-warning-700">
                    {dish.allergy}
                  </p>
                </div>
              ) : null}
            </div>

            {/* ─── Serving size radio buttons ─── */}
            {hasOptions ? (
              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Serving size
                </p>
                <div className="mt-2 space-y-2">
                  {activeOptions.map((opt) => {
                    const isSelected = opt.id === selectedOptionId;
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-all duration-150',
                          isSelected
                            ? 'bg-olive-50 ring-2 ring-olive-500'
                            : 'bg-white ring-1 ring-cream-200 hover:ring-cream-300'
                        )}
                      >
                        <input
                          type="radio"
                          name="serving-option"
                          value={opt.id}
                          checked={isSelected}
                          onChange={() => setSelectedOptionId(opt.id)}
                          className="h-4 w-4 shrink-0 accent-olive-700"
                        />
                        <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                          {opt.label}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-olive-700">
                          {formatPriceInput(opt.price, currency)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activeRemovableIngredients.length > 0 ? (
              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Leave out
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  Select ingredients you'd like removed. This is a preference request — the kitchen will do its best.
                </p>
                <div className="mt-2 space-y-2">
                  {activeRemovableIngredients.map((ing) => {
                    const isChecked = removedIds.has(ing.id);
                    return (
                      <label
                        key={ing.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-150',
                          isChecked
                            ? 'bg-olive-50 ring-2 ring-olive-500'
                            : 'bg-white ring-1 ring-cream-200 hover:ring-cream-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          value={ing.id}
                          checked={isChecked}
                          onChange={() => {
                            setRemovedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(ing.id)) next.delete(ing.id);
                              else next.add(ing.id);
                              return next;
                            });
                          }}
                          className="h-4 w-4 shrink-0 accent-olive-700"
                        />
                        <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                          No {ing.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* ─── Ordering controls ─── */}
            <div className="mt-6 border-t border-cream-200 pt-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-ink-soft">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-cream-300 transition-all duration-200 hover:ring-olive-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-[2rem] text-center text-base font-semibold text-ink" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                    aria-label="Increase quantity"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-cream-300 transition-all duration-200 hover:ring-olive-300"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className={cn(
                  'mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 active:scale-[0.99]',
                  added
                    ? 'bg-olive-600'
                    : 'bg-olive-700 hover:bg-olive-800 hover:shadow-lift'
                )}
              >
                {added ? (
                  <>
                    <Check className="h-4 w-4" />
                    Added to basket
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    Add to basket{formattedPrice ? ` · ${formattedPrice}` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{text}</p>
    </div>
  );
}
