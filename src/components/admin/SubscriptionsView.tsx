import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Notice } from '@/components/ui/Notice';
import { adminListSubscriptions, type AdminSubscriptionRow } from '@/lib/subscriptions';

function formatUsd(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents < 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<AdminSubscriptionRow['status'], string> = {
  incomplete: 'Awaiting payment',
  active: 'Active',
  payment_failed: 'Payment failed',
  canceled: 'Canceled — ends this period',
  expired: 'Expired',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function SubscriptionsView() {
  const [rows, setRows] = useState<AdminSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await adminListSubscriptions();
        if (active) setRows(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load subscriptions.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
        Loading subscriptions…
      </div>
    );
  }

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-6 text-sm text-ink-muted shadow-soft ring-1 ring-cream-200">
        No host subscriptions yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div
          key={row.subscriptionId}
          className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-cream-200"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-ink">
                {row.restaurantName}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">{row.ownerEmail}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Credit balance</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">{row.balance.toFixed(1)}</p>
            </div>
          </div>

          <dl className="mt-4 grid gap-4 border-t border-cream-200 pt-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Package</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {row.packageName || '—'}
                {row.scheduledPackageName ? ` → ${row.scheduledPackageName} (next renewal)` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Status</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{STATUS_LABELS[row.status]}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Billing period</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Next renewal</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {row.nextRenewal ? formatDate(row.nextRenewal) : 'Not renewing'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Auto-renewal</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{row.autoRenew ? 'On' : 'Off'}</dd>
            </div>
          </dl>

          {row.payments.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-cream-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-cream-50 text-xs uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Package</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 bg-white">
                  {row.payments.map((p, i) => (
                    <tr key={`${row.subscriptionId}-${p.cycleNumber}-${i}`}>
                      <td className="px-4 py-2 text-ink">{formatDate(p.paidAt ?? p.createdAt)}</td>
                      <td className="px-4 py-2 text-ink">{p.packageName ?? '—'}</td>
                      <td className="px-4 py-2 tabular-nums text-ink">{formatUsd(p.amountCents)}</td>
                      <td className="px-4 py-2 text-ink">{p.status}</td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-muted">{p.paymentRef ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
