import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Notice } from '@/components/ui/Notice';
import { adminListSubscriptions, type AdminSubscriptionRow, type PaymentRecord } from '@/lib/subscriptions';
import { generateSubscriptionInvoiceBlob, isTestPayment, type SubscriptionInvoiceData } from '@/lib/subscriptionInvoice';
import { SWEDISH_VAT_RATE, formatSek } from '@/lib/currency';

/** Safe SEK formatting: never shows NaN, undefined, or a misleading 0 for missing data. */
function formatSekSafe(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents < 0) return '—';
  return formatSek(cents);
}

/** Historical USD rows (pre-SEK migration) keep their original currency. */
function formatUsdLegacy(cents: number): string {
  return `${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<AdminSubscriptionRow['status'], string> = {
  incomplete: 'Awaiting payment',
  active: 'Active',
  payment_failed: 'Payment failed',
  canceled: 'Canceled — ends this period',
  expired: 'Expired',
};

const PAYMENT_TYPE_LABELS: Record<PaymentRecord['type'], string> = {
  subscription: 'Subscription',
  renewal: 'Renewal',
  topup: 'Top-up',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function paymentItem(p: PaymentRecord, row: AdminSubscriptionRow): string {
  if (p.type === 'topup') return `${Math.round(p.credits ?? 0)} credits`;
  return p.description ?? row.packageName ?? '—';
}

function downloadInvoice(row: AdminSubscriptionRow, p: PaymentRecord) {
  const isTopup = p.type === 'topup';
  const inv: SubscriptionInvoiceData = {
    title: isTopup ? 'Credit Top-up Invoice' : 'Subscription Invoice',
    footerNote: isTopup
      ? 'All top-up prices are in USD. Payment processed by Virgo Portals.'
      : 'All subscription prices are in SEK excluding VAT. Swedish VAT is added at checkout. Payment processed by Virgo Portals.',
    subscriptionRef: isTopup ? null : row.packageCode ? `sub-${row.packageCode}-${p.cycleNumber ?? ''}` : null,
    paymentRef: p.paymentRef,
    restaurantName: row.restaurantName,
    ownerEmail: row.ownerEmail,
    lineDescription: isTopup
      ? `Credit top-up — ${Math.round(p.credits ?? 0)} credits`
      : `${p.description ?? row.packageName ?? 'Subscription'} plan — monthly (cycle ${p.cycleNumber ?? ''})`,
    amountCents: p.amountCents,
    currency: p.currency || 'SEK',
    vatRate: isTopup ? 0 : SWEDISH_VAT_RATE,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    paidAt: p.paidAt ?? p.createdAt,
    isTest: isTestPayment(p.paymentRef),
  };
  const url = URL.createObjectURL(generateSubscriptionInvoiceBlob(inv));
  const a = document.createElement('a');
  a.href = url;
  a.download = isTopup
    ? `topup-invoice-${p.paidAt ?? p.createdAt}${inv.isTest ? '-TEST' : ''}.pdf`
    : `subscription-invoice-cycle-${p.cycleNumber ?? ''}${inv.isTest ? '-TEST' : ''}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
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
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Reference</th>
                    <th className="px-4 py-2 font-medium sr-only">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 bg-white">
                  {row.payments.map((p, i) => (
                    <tr key={`${row.subscriptionId}-${p.type}-${p.createdAt}-${i}`}>
                      <td className="px-4 py-2 text-ink">{formatDate(p.paidAt ?? p.createdAt)}</td>
                      <td className="px-4 py-2 text-ink">{PAYMENT_TYPE_LABELS[p.type]}</td>
                      <td className="px-4 py-2 text-ink">{paymentItem(p, row)}</td>
                      <td className="px-4 py-2 tabular-nums text-ink">{p.currency === 'USD' ? formatUsdLegacy(p.amountCents) : formatSekSafe(p.amountCents)}</td>
                      <td className="px-4 py-2 text-ink">{p.status}</td>
                      <td className="px-4 py-2 font-mono text-xs text-ink-muted">{p.paymentRef ?? '—'}</td>
                      <td className="px-4 py-2">
                        {p.status === 'succeeded' && p.invoiceUrl ? (
                          <a
                            href={p.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-olive-700 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Receipt
                          </a>
                        ) : p.status === 'succeeded' ? (
                          <button
                            type="button"
                            onClick={() => downloadInvoice(row, p)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-olive-700 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Invoice
                          </button>
                        ) : null}
                      </td>
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
