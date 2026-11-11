import { useCallback, useEffect, useState } from 'react';
import { Beaker, CalendarDays, CreditCard, Download, Loader2, RefreshCw, Repeat, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  cancelSubscription,
  changeScheduledPackage,
  getSubscriptionOverview,
  setAutoRenew,
  testCheckout,
  testRenewal,
  testTopUp,
  type HostSubscription,
  type PaymentRecord,
  type SubscriptionOverview,
} from '@/lib/subscriptions';
import { generateSubscriptionInvoiceBlob, isTestPayment, type SubscriptionInvoiceData } from '@/lib/subscriptionInvoice';
import { SWEDISH_VAT_RATE, formatSek, vatBreakdown } from '@/lib/currency';
import type { RestaurantPortal } from '@/types';

const TOKENS_PER_CREDIT = 900000;

const STATUS_LABELS: Record<HostSubscription['status'], string> = {
  incomplete: 'Awaiting payment',
  active: 'Active',
  payment_failed: 'Payment failed',
  canceled: 'Canceled — ends this period',
  expired: 'Expired',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const PAYMENT_TYPE_LABELS: Record<PaymentRecord['type'], string> = {
  subscription: 'Subscription',
  renewal: 'Renewal',
  topup: 'Top-up',
};

function paymentItem(p: PaymentRecord): string {
  if (p.type === 'topup') return `${Math.round(p.credits ?? 0)} credits`;
  return p.description ?? '—';
}

interface SubscriptionViewProps {
  portal: RestaurantPortal;
}

/** Safe SEK formatting: never shows NaN, undefined, or a misleading 0 for missing data. */
function formatSekSafe(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents < 0) return '—';
  return formatSek(cents);
}

/** Currency of a recorded payment; older rows may still be USD. */
function paymentCurrency(p: PaymentRecord): string {
  return p.currency || 'SEK';
}

/** Historical USD rows (pre-SEK migration) keep their original currency. */
function formatUsdLegacy(cents: number): string {
  return `${(cents / 100).toFixed(2)}`;
}

export function SubscriptionView({ portal }: SubscriptionViewProps) {
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [topupSecret, setTopupSecret] = useState('');

  const refresh = useCallback(async () => {
    const result = await getSubscriptionOverview();
    setOverview(result);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await getSubscriptionOverview();
        if (active) setOverview(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load your subscription.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That change could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
        Loading subscription…
      </div>
    );
  }

  if (!overview) return null;

  const { subscription, packages, topupPackages, canPurchaseTopup, balance, payments } = overview;
  const sub = subscription;
  const currentCode = sub?.packageCode ?? '';
  const scheduledCode = sub?.cancelAtPeriodEnd ? null : sub?.scheduledPackageCode ?? null;
  const scheduledPackage = packages.find((p) => p.code === scheduledCode);
  const currentPackage = packages.find((p) => p.code === currentCode);

  function downloadInvoice(p: PaymentRecord) {
    const isTopup = p.type === 'topup';
    const cur = paymentCurrency(p);
    const inv: SubscriptionInvoiceData = {
      title: isTopup ? 'Credit Top-up Invoice' : 'Subscription Invoice',
      footerNote: isTopup
        ? 'All top-up prices are in USD. Payment processed by Virgo Portals.'
        : 'All subscription prices are in SEK excluding VAT. Swedish VAT is added at checkout. Payment processed by Virgo Portals.',
      subscriptionRef: isTopup
        ? null
        : sub
          ? `sub-${currentCode}-${p.cycleNumber ?? ''}`
          : null,
      paymentRef: p.paymentRef,
      restaurantName: portal.name,
      ownerEmail: portal.ownerEmail ?? '',
      lineDescription: isTopup
        ? `Credit top-up — ${Math.round(p.credits ?? 0)} credits`
        : `${p.description ?? currentPackage?.name ?? 'Subscription'} plan — monthly (cycle ${p.cycleNumber ?? ''})`,
      amountCents: p.amountCents,
      currency: cur,
      vatRate: isTopup ? 0 : SWEDISH_VAT_RATE,
      periodStart: sub?.periodStart ?? null,
      periodEnd: sub?.periodEnd ?? null,
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

  return (
    <div className="mt-6 space-y-6">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Subscription</h2>

      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : null}

      {/* ── Current subscription ── */}
      <section
        className="rounded-2xl p-6"
        style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#77766F' }}>
              Current plan
            </p>
            {sub ? (
              <>
                <p className="mt-2 font-display text-2xl font-semibold text-ink">
                  {currentPackage?.name ?? sub.packageName}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {STATUS_LABELS[sub.status]}
                  {sub.periodStart && sub.periodEnd
                    ? ` · ${formatDate(sub.periodStart)} – ${formatDate(sub.periodEnd)}`
                    : ''}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 font-display text-2xl font-semibold text-ink">No subscription yet</p>
                <p className="mt-1 text-sm text-ink-muted">Choose a package below to get started.</p>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#77766F' }}>
              Available credits
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: '#292A27' }}>
              {balance.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-ink-faint">1 credit = {TOKENS_PER_CREDIT.toLocaleString()} tokens</p>
          </div>
        </div>

        {sub ? (
          <dl className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-3" style={{ borderColor: '#E5DED3' }}>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                <CalendarDays className="h-3.5 w-3.5" /> Next renewal
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {sub.nextRenewal ? formatDate(sub.nextRenewal) : sub.status === 'active' ? 'Not renewing' : '—'}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                <Repeat className="h-3.5 w-3.5" /> Auto-renewal
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">{sub.autoRenew ? 'On' : 'Off'}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                <CreditCard className="h-3.5 w-3.5" /> Scheduled change
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {sub.cancelAtPeriodEnd
                  ? 'Ends at period end'
                  : scheduledPackage
                    ? `${scheduledPackage.name} from next renewal`
                    : 'None'}
              </dd>
            </div>
          </dl>
        ) : null}

        {sub?.cancelAtPeriodEnd && sub.periodEnd ? (
          <p className="mt-4 rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700 ring-1 ring-warning-200">
            Your subscription will end on {formatDate(sub.periodEnd)}. Unused credits stay in your wallet.
          </p>
        ) : null}
      </section>

      {/* ── Package selection ── */}
      <section>
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Packages</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Changes take effect at your next renewal. Your current plan stays active until then — nothing is charged now.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {packages.map((pkg) => {
            const isCurrent = pkg.code === currentCode && !sub?.cancelAtPeriodEnd;
            const isScheduled = pkg.code === scheduledCode;
            return (
              <div
                key={pkg.code}
                className="relative flex flex-col rounded-2xl p-5"
                style={{
                  backgroundColor: isCurrent ? '#F3F5EE' : '#FAF8F4',
                  border: isCurrent ? '1.5px solid #7C8B5E' : '1px solid #E5DED3',
                }}
              >
                {isCurrent ? (
                  <span className="absolute right-4 top-4 rounded-full bg-olive-700 px-2.5 py-0.5 text-xs font-medium text-cream-100">
                    Current
                  </span>
                ) : isScheduled ? (
                  <span className="absolute right-4 top-4 rounded-full bg-olive-100 px-2.5 py-0.5 text-xs font-medium text-olive-700">
                    Next renewal
                  </span>
                ) : null}
                <p className="font-display text-lg font-semibold text-ink">{pkg.name}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{formatSek(pkg.priceCents)}<span className="text-sm font-normal text-ink-muted">/mo</span></p>
                <p className="text-xs text-ink-muted">excl. VAT</p>
                <p className="mt-1 text-sm text-ink-soft">{Math.round(pkg.credits).toLocaleString()} credits / month</p>
                <dl className="mt-3 space-y-0.5 border-t border-cream-200 pt-3 text-xs tabular-nums text-ink-soft">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Price excl. VAT</dt>
                    <dd>{formatSek(pkg.priceCents)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>VAT 25%</dt>
                    <dd>{formatSek(vatBreakdown(pkg.priceCents).vatMinor)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 font-semibold text-ink">
                    <dt>Total payable</dt>
                    <dd>{formatSek(vatBreakdown(pkg.priceCents).grossMinor)}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  {isCurrent ? (
                    <Button variant="secondary" size="sm" disabled>
                      Current plan
                    </Button>
                  ) : isScheduled ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => run(`undo-${pkg.code}`, async () => {
                        if (sub) {
                          // Deselecting a scheduled change is expressed by re-selecting nothing:
                          // set the schedule back to the current package.
                          await changeScheduledPackage(currentCode);
                        }
                      })}
                    >
                      {busy === `undo-${pkg.code}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Keep current plan
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy !== null || !sub}
                      onClick={() => run(`pick-${pkg.code}`, () => changeScheduledPackage(pkg.code))}
                    >
                      {busy === `pick-${pkg.code}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Schedule from next renewal
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!sub ? (
          <p className="mt-3 text-sm text-ink-muted">
            Initial subscription checkout will be available once the payment provider is connected. Contact the Virgo team to subscribe in the meantime.
          </p>
        ) : null}
      </section>

      {/* ── Credit top-up ── */}
      <section className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Top up credits</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Purchase additional credits for your wallet. 1 credit = {TOKENS_PER_CREDIT.toLocaleString()} tokens.
            </p>
          </div>
        </div>

        {!canPurchaseTopup ? (
          <p className="mt-4 rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700 ring-1 ring-warning-200">
            An active subscription is required to purchase top-up credits.
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-cream-50 px-4 py-3 text-xs leading-relaxed text-ink-muted ring-1 ring-cream-200">
            Top-up purchases are currently available through the test-payment flow. Enter the test mode secret to simulate a
            payment — no real money is charged.
          </p>
        )}

        {canPurchaseTopup ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={topupSecret}
              onChange={(e) => setTopupSecret(e.target.value)}
              placeholder="Test mode secret"
              className="w-56 rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive-500"
            />
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {topupPackages.map((pkg) => (
            <div
              key={pkg.code}
              className="flex flex-col rounded-2xl p-5"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5DED3' }}
            >
              <p className="font-display text-lg font-semibold text-ink">{pkg.name}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{Math.round(pkg.credits).toLocaleString()}</p>
              <p className="text-xs text-ink-faint">credits</p>
              <p className="mt-3 text-lg font-semibold tabular-nums text-ink">{formatSekSafe(pkg.priceCents)}</p>
              <div className="mt-4">
                <Button
                  size="sm"
                  disabled={busy !== null || !canPurchaseTopup || topupSecret.length === 0}
                  onClick={() =>
                    run(`topup-${pkg.code}`, async () => {
                      const result = await testTopUp(pkg.code, topupSecret);
                      if (!result.ok) {
                        throw new Error(result.message ?? 'Top-up purchase was not completed.');
                      }
                    })
                  }
                >
                  {busy === `topup-${pkg.code}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Buy
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Controls ── */}
      {sub ? (
        <section className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}>
          <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Controls</h3>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => run('autorenew', () => setAutoRenew(!sub.autoRenew))}
            >
              {busy === 'autorenew' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}
              {sub.autoRenew ? 'Disable auto-renewal' : 'Enable auto-renewal'}
            </Button>
            {sub.status === 'active' && !sub.cancelAtPeriodEnd ? (
              <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
                <XCircle className="h-4 w-4" />
                Cancel subscription
              </Button>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            {sub.autoRenew
              ? 'Your subscription renews automatically each month. Disabling auto-renewal keeps your paid period active until its end; after that the subscription expires.'
              : 'Auto-renewal is off. Your paid period stays active until its end; no further renewal payment will be attempted.'}
            {' '}Unused credits never expire and remain in your wallet.
          </p>
        </section>
      ) : null}

      {/* ── Payment history ── */}
      <section>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Payment history</h3>
          <Button variant="ghost" size="sm" onClick={() => run('refresh', refresh)} disabled={busy !== null}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No subscription payments yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-cream-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-50 text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium sr-only">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {payments.map((p, i) => (
                  <tr key={`${p.type}-${p.createdAt}-${i}`}>
                    <td className="px-4 py-3 text-ink">{formatDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-4 py-3 text-ink">{PAYMENT_TYPE_LABELS[p.type]}</td>
                    <td className="px-4 py-3 text-ink">{paymentItem(p)}</td>
                    <td className="px-4 py-3 tabular-nums text-ink">{p.currency === 'USD' ? formatUsdLegacy(p.amountCents) : formatSekSafe(p.amountCents)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          p.status === 'succeeded'
                            ? 'rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700'
                            : p.status === 'failed'
                              ? 'rounded-full bg-error-50 px-2 py-0.5 text-xs font-medium text-error-700'
                              : 'rounded-full bg-cream-200 px-2 py-0.5 text-xs font-medium text-ink-muted'
                        }
                      >
                        {p.status === 'succeeded' ? 'Paid' : p.status === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {p.paymentRef ?? '—'}
                    </td>
                    <td className="px-4 py-3">
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
                          onClick={() => downloadInvoice(p)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-olive-700 hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Invoice
                        </button>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription?"
        confirmLabel="Cancel subscription"
        busy={busy === 'cancel'}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          void run('cancel', cancelSubscription);
        }}
      >
        Cancellation takes effect at the end of your current paid period
        {sub?.periodEnd ? ` (${formatDate(sub.periodEnd)})` : ''}. No further payments will be taken, and unused
        credits stay in your wallet.
      </ConfirmDialog>

      {/* ── TEST-MODE ONLY: simulated payments, secret-gated server-side ── */}
      <TestPanel onDone={refresh} />
    </div>
  );
}

function TestPanel({ onDone }: { onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function run(key: string, fn: () => Promise<{ ok: boolean; simulated?: string; balance?: number; cycle?: number; message?: string }>) {
    setBusy(key);
    setResult(null);
    setFailed(false);
    try {
      const r = await fn();
      setFailed(!r.ok);
      setResult(r.message ?? `Simulated ${r.simulated ?? 'done'}${r.cycle ? ` (cycle ${r.cycle})` : ''}${r.balance !== undefined ? ` — balance ${r.balance}` : ''}`);
      await onDone();
    } catch (err) {
      setFailed(true);
      setResult(err instanceof Error ? err.message : 'Test action failed.');
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <div className="mt-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Beaker className="h-4 w-4" />
          Test payments
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl p-6" style={{ backgroundColor: '#FDF6EC', border: '1px dashed #D9A441' }}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink">
          <Beaker className="h-4 w-4" />
          Test payments (no real charge)
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Hide</Button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        Simulates payment confirmation through the real activation and credit-allocation workflow.
        Test records are marked with provider “mock-test”. The server only allows this when test mode is enabled.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Test mode secret"
          className="w-56 rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive-500"
        />
        <Button
          size="sm"
          disabled={busy !== null || secret.length === 0}
          onClick={() => run('checkout', () => testCheckout('starter', secret))}
        >
          {busy === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simulate Starter checkout
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null || secret.length === 0}
          onClick={() => run('renew', () => testRenewal(secret, { forceDue: true }))}
        >
          {busy === 'renew' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simulate successful renewal
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null || secret.length === 0}
          onClick={() => run('renew-fail', () => testRenewal(secret, { fail: true, forceDue: true }))}
        >
          {busy === 'renew-fail' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simulate failed renewal
        </Button>
      </div>
      {result ? (
        <div className="mt-3">
          <Notice tone={failed ? 'error' : 'success'}>{result}</Notice>
        </div>
      ) : null}
    </section>
  );
}
