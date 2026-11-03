import { useEffect, useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPriceInput } from '@/lib/currency';
import type { VisitorCombo } from '@/types';

const CLOSE_MS = 180;

interface ComboListPanelProps {
  combos: VisitorCombo[];
  currency: string;
  onClose: () => void;
  onSelect: (combo: VisitorCombo) => void;
}

export function ComboListPanel({ combos, currency, onClose, onSelect }: ComboListPanelProps) {
  const [closing, setClosing] = useState(false);

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

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-end justify-center sm:items-center', closing ? 'detail-out' : 'detail-in')}
      role="dialog"
      aria-modal="true"
      aria-label="Combos"
    >
      <button
        type="button"
        aria-label="Close combos"
        className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]"
        onClick={requestClose}
      />

      <div className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden bg-cream-50 shadow-lift sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-xl text-ink">Combos</h2>
            <p className="text-xs text-ink-muted">Build a set menu from the dishes you like</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-cream-100 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
          {combos.map((combo) => (
            <li key={combo.id}>
              <button
                type="button"
                onClick={() => onSelect(combo)}
                className="flex w-full items-center gap-4 rounded-2xl bg-white p-3 text-left shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
              >
                {combo.imageUrl ? (
                  <img src={combo.imageUrl} alt={combo.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-cream-100">
                    <ShoppingBag className="h-5 w-5 text-cream-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{combo.name}</p>
                  {combo.description ? <p className="line-clamp-2 text-xs text-ink-muted">{combo.description}</p> : null}
                </div>
                <p className="shrink-0 text-sm font-semibold text-ink">{formatPriceInput(combo.price, currency)}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
