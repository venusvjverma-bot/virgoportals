import { useState } from 'react';
import { Mascot } from 'wobnimo/react';
import { latte } from 'wobnimo/characters/latte';

const STATES = [
  'idle',
  'thinking',
  'listening',
  'speaking',
  'sleeping',
  'working',
  'error',
  'surprised',
  'celebrating',
  'sad',
] as const;

type MascotState = (typeof STATES)[number];

/**
 * Isolated investigation prototype for the Wobnimo "Latte" mascot.
 * Not connected to the visitor checkout. Removed by deleting this file and
 * the route below; nothing else depends on it.
 */
export function LatteMascotPrototype() {
  const [state, setState] = useState<MascotState>('idle');
  const [rendered, setRendered] = useState(true);

  return (
    <div className="min-h-screen bg-cream-100 p-6">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Wobnimo Latte — mascot prototype
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Isolated evaluation only. Not connected to the visitor checkout.
          </p>
        </header>

        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-cream-200">
          {rendered ? (
            <Mascot
              key="latte"
              character={latte}
              state={state}
              className="h-32 w-32"
              style={{ width: 128, height: 128 }}
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-cream-100 text-xs text-ink-faint">
              hidden
            </div>
          )}
          <p className="text-sm font-semibold text-ink">
            Current state: <span className="text-olive-700">{state}</span>
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Switch state
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setState(s)}
                className={
                  state === s
                    ? 'rounded-xl bg-olive-700 px-3 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200'
                    : 'rounded-xl bg-cream-50 px-3 py-2.5 text-sm font-medium text-ink ring-1 ring-cream-200 transition-all duration-200 hover:ring-olive-300'
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
          <div>
            <p className="text-sm font-semibold text-ink">Mount / unmount</p>
            <p className="text-xs text-ink-muted">
              Verifies the mascot appears and disappears on demand (checkout visibility rules).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRendered((v) => !v)}
            className="rounded-xl border-2 border-olive-700 px-4 py-2 text-sm font-semibold text-olive-700 transition-all duration-200 hover:bg-olive-50"
          >
            {rendered ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
    </div>
  );
}
