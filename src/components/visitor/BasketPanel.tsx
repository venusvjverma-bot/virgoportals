import { useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMinor, parsePriceToMinor, formatPriceInput } from '@/lib/currency';
import type { BasketItem } from '@/types';

interface BasketPanelProps {
  items: BasketItem[];
  restaurantName: string;
  resourceName: string;
  currency: string;
  onClose: () => void;
  onCheckout: () => void;
  onUpdateQuantity: (dishId: string, servingOptionId: string | null, quantity: number, removedKey?: string) => void;
  onRemove: (dishId: string, servingOptionId: string | null, removedKey?: string) => void;
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
}: BasketPanelProps) {
  const [closing, setClosing] = useState(false);

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
              {items.map((item) => (
                <li key={`${item.dishId}-${item.servingOptionId ?? ''}-${(item.removedIngredientIds ?? []).join(',')}`} className="flex gap-3 px-5 py-4 sm:px-6">
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
                    <h3 className="truncate text-sm font-semibold text-ink">{item.name}</h3>
                    <p className="text-xs text-ink-muted">
                      {formatPriceInput(item.price, currency)}
                      {item.servingLabel ? <span className="text-ink-faint"> · {item.servingLabel}</span> : null}
                    </p>
                    {item.removedIngredientLabels && item.removedIngredientLabels.length > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-ink-faint">
                        {item.removedIngredientLabels.map((l) => `No ${l}`).join(' · ')}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.dishId, item.servingOptionId ?? null, Math.max(0, item.quantity - 1), (item.removedIngredientIds ?? []).join(','))}
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
                        onClick={() => onUpdateQuantity(item.dishId, item.servingOptionId ?? null, Math.min(99, item.quantity + 1), (item.removedIngredientIds ?? []).join(','))}
                        aria-label={`Increase ${item.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-cream-300 transition-all duration-200 hover:ring-olive-300"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(item.dishId, item.servingOptionId ?? null, (item.removedIngredientIds ?? []).join(','))}
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
              ))}
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
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-olive-700 py-3.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-olive-800 hover:shadow-lift active:scale-[0.99]"
            >
              Go to checkout
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
