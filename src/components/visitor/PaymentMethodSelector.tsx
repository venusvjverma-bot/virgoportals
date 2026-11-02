import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PaymentMethod } from '@/types';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onSelectMethod: (method: PaymentMethod) => void;
}

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; description: string }[] = [
  { method: 'pay_to_staff', label: 'Pay to Staff', description: 'Pay at your table or counter' },
  { method: 'pay_online', label: 'Pay Online', description: 'Test payment, nothing is charged' },
];

export function PaymentMethodSelector({ selectedMethod, onSelectMethod }: PaymentMethodSelectorProps) {
  return (
    <section className="mb-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive-50 ring-1 ring-olive-100">
          <CreditCard className="h-5 w-5 text-olive-700" />
        </span>
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight text-ink">Payment method</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Choose how you would like to pay.</p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Payment method" className="mt-4 grid grid-cols-2 gap-3">
        {PAYMENT_OPTIONS.map(({ method, label, description }) => {
          const selected = selectedMethod === method;
          return (
            <label
              key={method}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all duration-200 focus-within:ring-2 focus-within:ring-green-500',
                selected
                  ? 'border-green-500 bg-green-50'
                  : 'border-cream-200 bg-cream-50 hover:border-olive-300 hover:bg-white'
              )}
            >
              <input
                type="radio"
                name="payment-method"
                value={method}
                checked={selected}
                onChange={() => onSelectMethod(method)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{label}</span>
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
              <span className="mt-1 text-xs text-ink-muted">{description}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
