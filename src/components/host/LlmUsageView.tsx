import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Notice } from '@/components/ui/Notice';
import { DailyTokenChart } from '@/components/host/DailyTokenChart';
import { getLlmUsageTotals } from '@/lib/portal';
import { formatTokenCount } from '@/lib/formatTokens';
import type { RestaurantPortal } from '@/types';

interface LlmUsageViewProps {
  portal: RestaurantPortal;
}

interface Totals {
  inputTokens: number;
  outputTokens: number;
}

export function LlmUsageView({ portal }: LlmUsageViewProps) {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await getLlmUsageTotals(portal.id);
        if (active) setTotals(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load usage data.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [portal.id]);

  return (
    <div className="mt-6">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">LLM Usage</h2>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
          Loading usage…
        </div>
      ) : error ? (
        <Notice tone="error" className="mt-4">{error}</Notice>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <UsageCard label="INPUT TOKENS" value={totals?.inputTokens ?? 0} />
          <UsageCard label="OUTPUT TOKENS" value={totals?.outputTokens ?? 0} />
        </div>
      )}

      <DailyTokenChart portal={portal} />
    </div>
  );
}

interface UsageCardProps {
  label: string;
  value: number;
}

function UsageCard({ label, value }: UsageCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6"
      style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: '#929B8E' }}
      />
      <p
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: '#77766F' }}
      >
        {label}
      </p>
      <p
        className="mt-3 text-3xl font-bold tabular-nums"
        style={{ color: '#292A27' }}
      >
        {formatTokenCount(value)}
      </p>
    </div>
  );
}
