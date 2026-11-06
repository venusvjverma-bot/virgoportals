import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { Button } from '@/components/ui/Button';
import { adminListUsage } from '@/lib/adminApi';
import type { UsageRow } from '@/types';

export function UsageView() {
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await adminListUsage());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load usage data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = (rows ?? []).reduce(
    (acc, row) => ({
      uploads: acc.uploads + row.uploads,
      images: acc.images + row.images,
      messages: acc.messages + row.messages,
    }),
    { uploads: 0, images: 0, messages: 0 }
  );

  return (
    <div className="space-y-5">
      <Card padded={false} className="animate-fade-in overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-cream-200 px-6 py-5">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Usage</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              All-time activity across restaurant portals.
            </p>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        {error ? <Notice tone="error" className="m-6 mt-0">{error}</Notice> : null}

        {loading && !rows ? (
          <div className="flex items-center gap-3 px-6 py-12 text-sm text-ink-muted">
            <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
            Loading usage…
          </div>
        ) : !error && rows ? (
          <div className="overflow-x-auto scrollbar-soft">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-50/60">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Host
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Menu Extractions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Images
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Visitor Messages
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors duration-150 hover:bg-cream-50">
                    <td className="px-6 py-4 text-sm font-medium text-ink">{row.host}</td>
                    <td className="px-6 py-4 text-right text-sm text-ink-soft">
                      {row.uploads.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-ink-soft">
                      {row.images.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-ink-soft">
                      {row.messages.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-ink-muted">
                      No usage activity has been recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t border-cream-300 bg-cream-50">
                  <td className="px-6 py-4 text-sm font-semibold text-ink">Total</td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-ink">
                    {totals.uploads.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-ink">
                    {totals.images.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-ink">
                    {totals.messages.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
