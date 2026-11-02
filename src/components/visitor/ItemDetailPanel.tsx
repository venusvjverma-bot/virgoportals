import { useEffect, useState, type ReactNode } from 'react';
import { Minus, Plus, UtensilsCrossed, X, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { categoryLabel, sectionLabel } from '@/lib/menuSections';
import { formatPriceInput } from '@/lib/currency';
import type { Dish, DishServingOption, DishRemovableIngredient } from '@/types';

const CLOSE_MS = 180;

export interface DishSelection {
  servingOption: DishServingOption | null;
  quantity: number;
  removedIngredientIds: string[];
  removedIngredientLabels: string[];
  additionalRequest: string;
}

interface ItemDetailPanelProps {
  dish: Dish;
  currency: string;
  onClose: () => void;
  onAddToBasket?: (dish: Dish, quantity: number, servingOption?: DishServingOption | null, removedIngredientIds?: string[], removedIngredientLabels?: string[], additionalRequest?: string) => void;
  editing?: { initial: DishSelection; onUpdate: (selection: DishSelection) => void };
}

const MAX_REQUEST_WORDS = 50;
const MAX_REQUEST_CHARS = 500;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function defaultServingOptionIndex(options: DishServingOption[]): number {
  if (options.length === 0) return -1;
  if (options.length === 1) return 0;
  if (options.length % 2 === 1) {
    return Math.floor(options.length / 2);
  }
  return options.length - 2;
}

export function ItemDetailPanel({ dish, currency, onClose, onAddToBasket, editing }: ItemDetailPanelProps) {
  const initial = editing?.initial;
  const [closing, setClosing] = useState(false);
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);

  const activeOptions = dish.servingOptions?.filter((o) => o.isActive !== false) ?? [];
  const hasOptions = activeOptions.length > 0;
  const defaultIdx = defaultServingOptionIndex(activeOptions);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(() => {
    const initialOptionId = initial?.servingOption?.id;
    if (initialOptionId && activeOptions.some((o) => o.id === initialOptionId)) return initialOptionId;
    return defaultIdx >= 0 ? activeOptions[defaultIdx].id : null;
  });

  const activeRemovableIngredients = (dish.removableIngredients ?? []).filter((i) => i.isActive !== false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set(
    (initial?.removedIngredientIds ?? []).filter((id) => activeRemovableIngredients.some((i) => i.id === id))
  ));
  const [requestOpen, setRequestOpen] = useState(Boolean(initial?.additionalRequest));
  const [additionalRequest, setAdditionalRequest] = useState(initial?.additionalRequest ?? '');
  const requestWords = countWords(additionalRequest);

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

  function buildSelection(): DishSelection {
    return {
      servingOption: selectedOption,
      quantity,
      removedIngredientIds: [...removedIds],
      removedIngredientLabels: activeRemovableIngredients.filter((i) => removedIds.has(i.id)).map((i) => i.label),
      additionalRequest: additionalRequest.trim(),
    };
  }

  function handleSubmit() {
    const selection = buildSelection();
    if (editing) {
      editing.onUpdate(selection);
      requestClose();
      return;
    }
    onAddToBasket?.(dish, selection.quantity, selection.servingOption, selection.removedIngredientIds, selection.removedIngredientLabels, selection.additionalRequest);
    requestClose();
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
          'mt-3 rounded-t-3xl sm:mt-0 sm:max-h-[88dvh] sm:max-w-lg sm:rounded-3xl'
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
              className="mx-auto h-72 w-full rounded-t-3xl border border-cream-300 bg-cream-100 object-contain sm:h-80"
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

            {/* ─── Additional request ─── */}
            <div className="mt-5">
              {requestOpen ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="additional-request" className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Additional request
                    </label>
                    <span
                      aria-live="polite"
                      className={cn(
                        'text-xs font-medium tabular-nums',
                        requestWords >= MAX_REQUEST_WORDS ? 'text-warning-700' : 'text-ink-faint'
                      )}
                    >
                      {requestWords}/{MAX_REQUEST_WORDS} words
                    </span>
                  </div>
                  <textarea
                    id="additional-request"
                    rows={2}
                    value={additionalRequest}
                    maxLength={MAX_REQUEST_CHARS}
                    placeholder="For example: extra sauce on the side"
                    onChange={(event) => {
                      const next = event.target.value;
                      if (countWords(next) <= MAX_REQUEST_WORDS) setAdditionalRequest(next);
                    }}
                    className="mt-2 w-full resize-none rounded-xl border-0 bg-white px-4 py-3 text-sm text-ink shadow-soft ring-1 ring-inset ring-cream-300 transition-all duration-200 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-olive-500"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                    Note: Additional requests are subject to kitchen preparation standards and cannot be guaranteed. 😊
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAdditionalRequest('');
                      setRequestOpen(false);
                    }}
                    className="mt-2 text-xs font-semibold text-error-600 underline-offset-2 transition-colors duration-200 hover:underline"
                  >
                    Remove request
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRequestOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-olive-700 ring-1 ring-olive-300 transition-all duration-200 hover:bg-olive-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Additional Request
                </button>
              )}
            </div>

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
                onClick={handleSubmit}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-olive-700 py-3.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-olive-800 hover:shadow-lift active:scale-[0.99]"
              >
                {editing ? (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    Update Item{formattedPrice ? ` · ${formattedPrice}` : ''}
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
