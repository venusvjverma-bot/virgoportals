import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Coins,
  History,
  Loader2,
  Minus,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/cn';
import {
  adminAdjustCredit,
  adminListCreditAdjustments,
  adminListCredits,
} from '@/lib/adminApi';
import type { CreditAdjustment, CreditHost } from '@/types';

function formatBalance(value: number): string {
  return value.toFixed(1);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function operationLabel(op: string): string {
  switch (op) {
    case 'add':
      return 'Credit added';
    case 'remove':
      return 'Credit removed';
    case 'deduct':
      return 'LLM usage';
    case 'initial':
      return 'Initial allocation';
    default:
      return op;
  }
}

export function CreditsView() {
  const [hosts, setHosts] = useState<CreditHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedHost, setSelectedHost] = useState<CreditHost | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminListCredits();
      setHosts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load credit data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return hosts;
    return hosts.filter(
      (h) =>
        h.name.toLowerCase().includes(needle) ||
        h.email.toLowerCase().includes(needle) ||
        h.city.toLowerCase().includes(needle)
    );
  }, [hosts, query]);

  async function handleAdjusted(updatedHost: CreditHost) {
    setHosts((prev) =>
      prev.map((h) => (h.restaurantId === updatedHost.restaurantId ? updatedHost : h))
    );
    setSelectedHost(updatedHost);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
        Loading credit data…
      </div>
    );
  }

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-cream-200 animate-fade-in">
        <div className="flex items-center gap-3 rounded-xl bg-cream-50 px-4 py-2.5 ring-1 ring-cream-200">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by restaurant, email, or city"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-cream-200 animate-fade-in">
        <div className="overflow-x-auto scrollbar-soft">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/60">
                {['Restaurant', 'Email', 'Balance', 'LLM status', ''].map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-ink-muted"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              {filtered.map((host) => (
                <tr
                  key={host.restaurantId}
                  onClick={() => setSelectedHost(host)}
                  className="cursor-pointer transition-colors duration-150 hover:bg-cream-50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-ink">{host.name}</td>
                  <td className="px-6 py-4 text-sm text-ink-soft">{host.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-ink">
                      <Coins className="h-3.5 w-3.5 text-olive-500" />
                      {formatBalance(host.balance)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {host.llmActive ? (
                      <Badge tone="success">
                        <Zap className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge tone="warning">
                        <ZapOff className="h-3 w-3" />
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-medium text-olive-600">
                    Manage
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-ink-muted">
                    No hosts match that search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedHost ? (
        <CreditDetailDrawer
          host={selectedHost}
          onClose={() => setSelectedHost(null)}
          onAdjusted={handleAdjusted}
        />
      ) : null}
    </div>
  );
}

interface CreditDetailDrawerProps {
  host: CreditHost;
  onClose: () => void;
  onAdjusted: (host: CreditHost) => void;
}

function CreditDetailDrawer({ host, onClose, onAdjusted }: CreditDetailDrawerProps) {
  const [adjustments, setAdjustments] = useState<CreditAdjustment[]>([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(true);
  const [showConfirm, setShowConfirm] = useState<'add' | 'remove' | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await adminListCreditAdjustments(host.restaurantId);
        if (active) setAdjustments(result);
      } catch {
        // audit trail is informational; silently skip on error
      } finally {
        if (active) setLoadingAdjustments(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [host.restaurantId, successMsg]);

  const parsedAmount = parseFloat(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const resultingBalance =
    showConfirm === 'add'
      ? host.balance + (isValidAmount ? parsedAmount : 0)
      : showConfirm === 'remove'
        ? host.balance - (isValidAmount ? parsedAmount : 0)
        : host.balance;
  const wouldGoNegative = showConfirm === 'remove' && isValidAmount && parsedAmount > host.balance;

  async function handleConfirm() {
    if (!showConfirm || !isValidAmount) return;
    setSubmitting(true);
    setActionError(null);
    setSuccessMsg(null);
    try {
      const result = await adminAdjustCredit(host.restaurantId, showConfirm, parsedAmount);
      const updatedHost: CreditHost = {
        ...host,
        balance: result.resultingBalance,
        llmActive: result.resultingBalance > 0,
      };
      onAdjusted(updatedHost);
      setSuccessMsg(
        `${showConfirm === 'add' ? 'Added' : 'Removed'} ${parsedAmount} credit${parsedAmount === 1 ? '' : 's'}. New balance: ${formatBalance(result.resultingBalance)}.`
      );
      setShowConfirm(null);
      setAmount('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not adjust credits.');
    } finally {
      setSubmitting(false);
    }
  }

  function startAction(op: 'add' | 'remove') {
    setActionError(null);
    setSuccessMsg(null);
    setAmount('');
    setShowConfirm(op);
  }

  function cancelAction() {
    setShowConfirm(null);
    setAmount('');
    setActionError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close credit details"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/25 backdrop-blur-[2px]"
      />
      <aside className="relative flex h-full w-full max-w-lg animate-slide-in-right flex-col bg-white shadow-lift">
        <header className="flex items-start justify-between gap-4 border-b border-cream-200 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Credit Controller
            </p>
            <h2 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-ink">
              {host.name}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {host.email} · {host.city}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-ink-muted transition-colors duration-200 hover:bg-cream-100 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 scrollbar-soft">
          {/* Balance and status cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-cream-50 p-4 ring-1 ring-inset ring-cream-200">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Balance</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
                {formatBalance(host.balance)}
              </p>
            </div>
            <div className="rounded-xl bg-cream-50 p-4 ring-1 ring-inset ring-cream-200">
              <p className="text-xs uppercase tracking-wide text-ink-muted">LLM status</p>
              <div className="mt-1.5">
                {host.llmActive ? (
                  <Badge tone="success">
                    <Zap className="h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    <ZapOff className="h-3 w-3" />
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {successMsg ? (
            <div className="rounded-xl bg-success-50 px-4 py-3 ring-1 ring-success-200">
              <p className="text-sm font-medium text-success-700">{successMsg}</p>
            </div>
          ) : null}

          {actionError ? <Notice tone="error">{actionError}</Notice> : null}

          {/* Action buttons or confirmation form */}
          {showConfirm ? (
            <div className="rounded-xl bg-cream-50 p-5 ring-1 ring-cream-200">
              <div className="flex items-center gap-2">
                {showConfirm === 'add' ? (
                  <TrendingUp className="h-5 w-5 text-success-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-error-600" />
                )}
                <h3 className="font-display text-lg font-semibold text-ink">
                  {showConfirm === 'add' ? 'Add credits' : 'Remove credits'}
                </h3>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Amount
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 1.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1"
                    autoFocus
                  />
                </div>

                <div className="rounded-lg bg-white p-3 ring-1 ring-cream-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Current balance</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {formatBalance(host.balance)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-ink-muted">
                      {showConfirm === 'add' ? 'Adding' : 'Removing'}
                    </span>
                    <span className="font-semibold tabular-nums text-ink">
                      {isValidAmount ? formatBalance(parsedAmount) : '—'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between border-t border-cream-200 pt-1.5 text-sm">
                    <span className="font-medium text-ink">Resulting balance</span>
                    <span
                      className={cn(
                        'font-bold tabular-nums',
                        wouldGoNegative ? 'text-error-600' : 'text-ink'
                      )}
                    >
                      {formatBalance(Math.max(0, resultingBalance))}
                    </span>
                  </div>
                </div>

                {wouldGoNegative ? (
                  <div className="flex items-center gap-2 rounded-lg bg-error-50 px-3 py-2 ring-1 ring-error-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-error-600" />
                    <p className="text-xs font-medium text-error-700">
                      Cannot remove more credits than the available balance.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={cancelAction} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={submitting || !isValidAmount || wouldGoNegative}
                  variant={showConfirm === 'add' ? 'primary' : 'danger'}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : showConfirm === 'add' ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                  {submitting ? 'Processing…' : 'Confirm'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button onClick={() => startAction('add')} className="flex-1">
                <Plus className="h-4 w-4" />
                Add credits
              </Button>
              <Button
                variant="danger"
                onClick={() => startAction('remove')}
                disabled={host.balance <= 0}
                className="flex-1"
              >
                <Minus className="h-4 w-4" />
                Remove credits
              </Button>
            </div>
          )}

          {/* Audit trail */}
          <div>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-ink-muted" />
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Adjustment history
              </p>
            </div>
            {loadingAdjustments ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
                Loading…
              </div>
            ) : adjustments.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">No adjustments yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {adjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between rounded-lg bg-cream-50 px-4 py-2.5 ring-1 ring-cream-200"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {operationLabel(adj.operation)}
                      </p>
                      <p className="text-xs text-ink-faint">{formatDateTime(adj.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          adj.operation === 'add' || adj.operation === 'initial'
                            ? 'text-success-600'
                            : 'text-ink-soft'
                        )}
                      >
                        {adj.operation === 'add' || adj.operation === 'initial' ? '+' : '-'}
                        {formatBalance(adj.amount)}
                      </p>
                      <p className="text-xs text-ink-faint">
                        → {formatBalance(adj.resultingBalance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
