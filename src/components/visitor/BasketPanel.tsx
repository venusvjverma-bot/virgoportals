import { useState } from 'react';
import { Clock, Minus, Plus, ShoppingBag, Trash2, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { basketLineKey, groupAddOns } from '@/lib/basketLine';
import { formatMinor, parsePriceToMinor, formatPriceInput } from '@/lib/currency';
import type { BasketItem, DishServingOption } from '@/types';
import { ComboSelectionLines } from '@/components/visitor/ComboSelectionLines';

interface BasketPanelProps {
  items: BasketItem[];
  restaurantName: string;
  resourceName: string;
  currency: string;
  onClose: () => void;
  onCheckout: () => void;
  onUpdateQuantity: (dishId: string, servingOptionId: string | null, quantity: number, removedKey?: string) => void;
  onRemove: (dishId: string, servingOptionId: string | null, removedKey?: string) => void;
  servingOptionsByDish: Record<string, DishServingOption[]>;
  onChangeServingSize: (dishId: string, servingOptionId: string | null, removedKey: string, option: DishServingOption) => void;
  onEditItem: (item: BasketItem) => void;
  canEditItem: (item: BasketItem) => boolean;
  checkoutBlocked?: boolean;
  checkoutBlockedMessage?: string;
}

export function BasketPanel({
  items,
  restaurantName,
  resourceName,
  currency,
  onClose,
  onCheckout,
  onUpdateQuantity,
  onRemove,
  servingOptionsByDish,
  onChangeServingSize,
  onEditItem,
  canEditItem,
  checkoutBlocked = false,
  checkoutBlockedMessage,
}: BasketPanelProps) {
  const [closing, setClosing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  function requestClose() {
    setClosing((already) => {
      if (!already) window.setTimeout(onClose, 180);
      return true;
    });
  }

  const totalMinor = items.reduce((sum, item) => {
    const unit = parsePriceToMinor(item.price) ?? 0;
    return sum + (unit * item.quantity);
  }, 0);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center sm:items-center',
        closing ? 'detail-out' : 'detail-in'
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Your basket"
    >
      <button
        type="button"
        aria-label="Close basket"
        className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]"
        onClick={requestClose}
      />

      <div
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-cream-50 shadow-lift',
          'rounded-t-3xl sm:max-h-[88dvh] sm:max-w-lg sm:rounded-3xl'
        )}
      >
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-olive-700" />
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Your basket</h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close basket"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-cream-200 px-5 py-2.5 sm:px-6">
          <p className="text-xs text-ink-muted">
            {restaurantName}
            {resourceName && resourceName !== restaurantName ? ` · ${resourceName}` : ''}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <ShoppingBag className="h-10 w-10 text-cream-300" />
              <p className="mt-3 text-sm text-ink-muted">Your basket is empty.</p>
              <p className="mt-1 text-xs text-ink-faint">Browse the menu and add items to get started.</p>
            </div>
          ) : (
            <ul className="divide-y divide-cream-200">
              {items.map((item) => {
                const removedKey = basketLineKey(item);
                const lineKey = `${item.dishId}-${item.servingOptionId ?? ''}-${removedKey}`;
                const sizeOptions = (servingOptionsByDish[item.dishId] ?? []).filter((o) => o.isActive !== false);
                const isEditingSize = editingKey === lineKey;
                const unitMinor = parsePriceToMinor(item.price) ?? 0;
                const variantMinor = parsePriceToMinor(item.variantAdditionalPrice ?? '') ?? 0;
                const addOnMinor = (item.addOns ?? []).reduce((sum, addOn) => sum + (parsePriceToMinor(addOn.price) ?? 0), 0);
                const extraMinor = variantMinor + addOnMinor;
                return (
                <li key={lineKey} className="flex gap-3 px-5 py-4 sm:px-6">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-cream-200"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-cream-100 ring-1 ring-cream-200">
                      <ShoppingBag className="h-5 w-5 text-cream-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-ink">
                      {canEditItem(item) ? (
                        <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          aria-label={`Edit ${item.name}`}
                          className="block max-w-full truncate text-left underline-offset-2 transition-colors duration-200 hover:text-olive-700 hover:underline"
                        >
                          {item.name}
                        </button>
                      ) : (
                        item.name
                      )}
                    </h3>
                    <p className="text-xs text-ink-muted">
                      {formatPriceInput(item.price, currency)}
                      {item.servingLabel ? <span className="text-ink-faint"> · {item.servingLabel}</span> : null}
                    </p>
                    {item.variantName ? (
                      <div className="mt-1 space-y-0.5 text-xs text-ink-muted">
                        <p>
                          <span className="font-medium text-ink">Option:</span> {item.variantName}
                        </p>
                        <p className="text-ink-faint">
                          Base {formatMinor(unitMinor - extraMinor, currency)} + {formatMinor(extraMinor, currency)} = {formatMinor(unitMinor, currency)} each
                        </p>
                      </div>
                    ) : null}
                    {groupAddOns(item.addOns ?? []).length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
                        {groupAddOns(item.addOns ?? []).map(({ addOn, count }) => (
                          <li key={addOn.id} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate font-medium text-ink">+ {count > 1 ? `${count} x ` : ''}{addOn.name}</span>
                            <span className="shrink-0 font-medium text-ink-soft">{formatMinor((parsePriceToMinor(addOn.price) ?? 0) * count, currency)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {item.comboSelections && item.comboSelections.length > 0 ? (
                      <ComboSelectionLines selections={item.comboSelections} />
                    ) : null}
                    {item.removedIngredientLabels && item.removedIngredientLabels.length > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-ink-faint">
                        {item.removedIngredientLabels.map((l) => `No ${l}`).join(' · ')}
                      </p>
                    ) : null}
                    {item.additionalRequest ? (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        <span className="font-medium text-ink">Request:</span> {item.additionalRequest}
                      </p>
                    ) : null}
                    {sizeOptions.length > 1 ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setEditingKey(isEditingSize ? null : lineKey)}
                          aria-expanded={isEditingSize}
                          className="text-xs font-semibold text-olive-700 underline-offset-2 transition-colors duration-200 hover:text-olive-800 hover:underline"
                        >
                          {isEditingSize ? 'Cancel' : 'Edit size'}
                        </button>
                        {isEditingSize ? (
                          <div role="radiogroup" aria-label={`Sizes for ${item.name}`} className="mt-2 flex flex-wrap gap-2">
                            {sizeOptions.map((option) => {
                              const isCurrent = option.id === item.servingOptionId;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isCurrent}
                                  onClick={() => {
                                    setEditingKey(null);
                                    if (!isCurrent) onChangeServingSize(item.dishId, item.servingOptionId ?? null, removedKey, option);
                                  }}
                                  className={cn(
                                    'rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all duration-200',
                                    isCurrent
                                      ? 'bg-olive-700 text-white ring-olive-700'
                                      : 'bg-white text-ink ring-cream-300 hover:ring-olive-400'
                                  )}
                                >
                                  {option.label} · {formatPriceInput(option.price, currency)}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.dishId, item.servingOptionId ?? null, Math.max(0, item.quantity - 1), basketLineKey(item))}
                        aria-label={`Decrease ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-cream-300 transition-all duration-200 hover:ring-olive-300"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm font-semibold text-ink">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.dishId, item.servingOptionId ?? null, Math.min(99, item.quantity + 1), basketLineKey(item))}
                        aria-label={`Increase ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-cream-300 transition-all duration-200 hover:ring-olive-300"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(item.dishId, item.servingOptionId ?? null, basketLineKey(item))}
                        aria-label={`Remove ${item.name}`}
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-error-500 transition-all duration-200 hover:bg-error-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold text-olive-700">
                      {formatMinor((parsePriceToMinor(item.price) ?? 0) * item.quantity, currency)}
                    </span>
                  </div>
                </li>
                );
              })}
            </ul>
          )}

        </div>

        {items.length > 0 ? (
          <div className="border-t border-cream-200 px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-soft">Total</span>
              <span className="font-display text-lg font-semibold text-ink">
                {formatMinor(totalMinor, currency)}
              </span>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              disabled={checkoutBlocked}
              className={cn(
                'mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold shadow-soft transition-all duration-200 active:scale-[0.99]',
                checkoutBlocked
                  ? 'cursor-not-allowed bg-olive-700/40 text-white'
                  : 'bg-olive-700 text-white hover:bg-olive-800 hover:shadow-lift'
              )}
            >
              {checkoutBlocked ? 'Checkout unavailable' : 'Go to checkout'}
              {checkoutBlocked ? <Clock className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </button>
            {checkoutBlocked && checkoutBlockedMessage ? (
              <div
                className="mt-3 flex items-start gap-2.5 rounded-xl px-4 py-3"
                style={{ backgroundColor: '#FFF0DF', border: '1px solid #EB7C10' }}
                role="status"
              >
                <Clock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#A94B0B' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#A94B0B' }}>
                    We&apos;re closed for today
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: '#A94B0B' }}>
                    {checkoutBlockedMessage}
                  </p>
                </div>
              </div>
            ) : checkoutBlocked ? (
              <p className="mt-3 text-center text-xs text-ink-muted">
                This department is currently not accepting orders. Please try again later.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
