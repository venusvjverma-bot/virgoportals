import { Heart } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatMinor } from '@/lib/currency';
import { TIP_OPTIONS, computeTipMinor } from '@/lib/tip';
import type { TipOption } from '@/types';

interface TipSelectorProps {
  currency: string;
  subtotalMinor: number;
  selectedOption: TipOption;
  customInput: string;
  customError: string | null;
  tipMinor: number;
  totalMinor: number;
  onSelectOption: (option: TipOption) => void;
  onCustomInputChange: (value: string) => void;
}

export function TipSelector({
  currency,
  subtotalMinor,
  selectedOption,
  customInput,
  customError,
  tipMinor,
  totalMinor,
  onSelectOption,
  onCustomInputChange,
}: TipSelectorProps) {
  return (
    <section className="mb-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-100">
          <Heart className="h-5 w-5 text-rose-500" />
        </span>
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight text-ink">Share a little love ❤️</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Your kindness makes our day!</p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Tip" className="mt-4 grid grid-cols-2 gap-3">
        {TIP_OPTIONS.map(({ option, label }) => {
          const selected = selectedOption === option;
          const amountText =
            option === 'custom'
              ? 'Enter an amount'
              : option === 'none'
                ? null
                : formatMinor(computeTipMinor(option, 0, subtotalMinor), currency);
          return (
            <label
              key={option}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all duration-200 focus-within:ring-2 focus-within:ring-green-500',
                selected
                  ? 'border-green-500 bg-green-50'
                  : 'border-cream-200 bg-cream-50 hover:border-olive-300 hover:bg-white'
              )}
            >
              <input
                type="radio"
                name="tip-option"
                value={option}
                checked={selected}
                onChange={() => onSelectOption(option)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold text-ink">{label}</span>
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
                    selected ? 'border-green-600' : 'border-cream-300'
                  )}
                  aria-hidden="true"
                >
                  {selected ? <span className="h-2.5 w-2.5 rounded-full bg-green-600" /> : null}
                </span>
              </span>
              {amountText ? <span className="mt-1 text-xs text-ink-muted">{amountText}</span> : null}
            </label>
          );
        })}
      </div>

      {selectedOption === 'custom' ? (
        <div className="mt-4">
          <label htmlFor="tip-custom-amount" className="text-xs font-medium text-ink-muted">
            Amount ({currency})
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="tip-custom-amount"
              type="text"
              inputMode="decimal"
              value={customInput}
              onChange={(e) => onCustomInputChange(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
              className="flex-1 rounded-xl border-0 bg-cream-50 px-4 py-3 text-sm text-ink shadow-soft ring-1 ring-inset ring-cream-300 transition-all duration-200 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={() => onCustomInputChange('')}
              disabled={!customInput}
              className="rounded-xl bg-white px-4 text-sm font-medium text-ink-soft ring-1 ring-cream-300 transition-all duration-200 hover:text-ink disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          {customError ? <p className="mt-1.5 text-xs font-medium text-error-600">{customError}</p> : null}
        </div>
      ) : null}

      <dl className="mt-4 space-y-2 border-t border-cream-200 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-soft">Order subtotal</dt>
          <dd className="font-medium text-ink">{formatMinor(subtotalMinor, currency)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-soft">Your tip</dt>
          <dd className="font-medium text-ink">{formatMinor(tipMinor, currency)}</dd>
        </div>
        <div className="flex items-center justify-between pt-1">
          <dt className="font-semibold text-ink">Total including tip</dt>
          <dd className="font-display text-lg font-semibold text-ink">{formatMinor(totalMinor, currency)}</dd>
        </div>
      </dl>
    </section>
  );
}
