import { useRef } from 'react';
import { Mascot } from 'wobnimo/react';
import { latte } from 'wobnimo/characters/latte';
import { cn } from '@/lib/cn';

export type CheckoutMascotState = 'listening' | 'celebrating' | 'working' | 'error';

/**
 * Single shared Latte instance for the visitor checkout. Stays mounted so the
 * WebGL context is not rebuilt between reactions; visibility is a fade only.
 */
export function CheckoutMascot({ state }: { state: CheckoutMascotState | null }) {
  const lastState = useRef<CheckoutMascotState>('listening');
  if (state) lastState.current = state;
  const visible = state !== null;

  return (
    <div
      aria-hidden={state === null}
      className={cn(
        'pointer-events-none fixed right-3 top-20 z-30 transition-all duration-300 ease-out sm:right-6',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      )}
    >
      <div className="h-24 w-24 drop-shadow-soft sm:h-28 sm:w-28">
        <Mascot character={latte} state={lastState.current} className="h-full w-full" />
      </div>
    </div>
  );
}
