import { useEffect, useState, useCallback } from 'react';
import { Loader2, Zap, ZapOff } from 'lucide-react';
import { getHostCreditBalance } from '@/lib/portal';
import { supabase } from '@/lib/supabase';
import type { RestaurantPortal } from '@/types';

interface CreditWalletViewProps {
  portal: RestaurantPortal;
}

function formatCredits(balance: number): string {
  return balance.toFixed(1);
}

export function CreditWalletView({ portal }: CreditWalletViewProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getHostCreditBalance(portal.id);
      setBalance(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load credit balance.');
    }
  }, [portal.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await getHostCreditBalance(portal.id);
        if (active) setBalance(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load credit balance.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    // Live updates: subscribe to host_credits changes for this restaurant.
    // The visitor-chat edge function deducts credits after each LLM call, so
    // the wallet updates in real time as visitors use the chat.
    const channel = supabase
      .channel(`host_credits:${portal.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'host_credits',
          filter: `restaurant_id=eq.${portal.id}`,
        },
        () => {
          refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'host_credit_adjustments',
          filter: `restaurant_id=eq.${portal.id}`,
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [portal.id, refresh]);

  const isActive = (balance ?? 0) > 0;

  return (
    <div className="mt-6">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Credit Wallet</h2>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
          Loading balance…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl bg-error-50 p-4 ring-1 ring-error-200">
          <p className="text-sm font-medium text-error-700">{error}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div
              className="relative overflow-hidden rounded-2xl p-6"
              style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: isActive ? '#7C8B5E' : '#C4A35A' }}
              />
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: '#77766F' }}
              >
                Available credits
              </p>
              <p
                className="mt-3 text-3xl font-bold tabular-nums"
                style={{ color: '#292A27' }}
              >
                {formatCredits(balance ?? 0)}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                1 credit = 900,000 tokens
              </p>
            </div>

            <div
              className="relative overflow-hidden rounded-2xl p-6"
              style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}
            >
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: isActive ? '#5B7A3E' : '#B8860B' }}
              />
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: '#77766F' }}
              >
                LLM service
              </p>
              <div className="mt-3 flex items-center gap-2">
                {isActive ? (
                  <>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-100 text-success-600">
                      <Zap className="h-4 w-4" />
                    </span>
                    <span className="text-xl font-semibold text-success-700">Active</span>
                  </>
                ) : (
                  <>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning-100 text-warning-600">
                      <ZapOff className="h-4 w-4" />
                    </span>
                    <span className="text-xl font-semibold text-warning-700">Inactive</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                {isActive
                  ? 'Your chat assistant is available to visitors.'
                  : 'LLM access is unavailable because no credits remain. Contact the Virgo team to add credits.'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
