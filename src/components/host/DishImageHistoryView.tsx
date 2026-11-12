import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Notice } from '@/components/ui/Notice';
import { listDishImageHistory } from '@/lib/portal';
import type { DishImageGenerationRow } from '@/lib/dishImageHistory';
import type { RestaurantPortal } from '@/types';

const INK = '#292A27';
const MUTED = '#77766F';

interface DishImageHistoryViewProps {
  portal: RestaurantPortal;
}

function formatTimestamp(iso: string, timezone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
  return `${day}, ${time}`;
}

function StatusBadge({ row }: { row: DishImageGenerationRow }) {
  if (row.status === 'succeeded') {
    return (
      <span className="rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-semibold text-success-700">
        Success
      </span>
    );
  }
  if (row.refunded) {
    return (
      <span className="rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-semibold text-warning-700">
        Refunded
      </span>
    );
  }
  if (row.status === 'failed') {
    return (
      <span className="rounded-full bg-error-100 px-2.5 py-0.5 text-xs font-semibold text-error-700">
        Failed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
      In progress
    </span>
  );
}

export function DishImageHistoryView({ portal }: DishImageHistoryViewProps) {
  const timezone = portal.timezone || 'UTC';
  const [rows, setRows] = useState<DishImageGenerationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await listDishImageHistory(portal.id);
        if (active) setRows(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load the image history.');
      }
    })();
    return () => {
      active = false;
    };
  }, [portal.id]);

  return (
    <div className="mt-6">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
        Dish Image Generation History
      </h2>

      {error ? (
        <Notice tone="error" className="mt-4">{error}</Notice>
      ) : !rows ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
          Loading history…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="mt-4 rounded-2xl p-6 text-center"
          style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}
        >
          <p className="text-sm font-medium text-ink">No image generations yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            When you generate a dish or combo image, it will be listed here with its credit cost.
          </p>
        </div>
      ) : (
        <div
          className="mt-4 overflow-hidden rounded-2xl"
          style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}
        >
          <div className="hidden grid-cols-[1.5fr_2fr_1fr_1.1fr_1.4fr] gap-3 border-b px-5 py-3 text-xs font-medium uppercase tracking-wide sm:grid"
            style={{ borderColor: '#E5DED3', color: MUTED }}
          >
            <span>Date &amp; time</span>
            <span>Dish / combo</span>
            <span className="text-right">Credit</span>
            <span>Status</span>
            <span>Generation ID</span>
          </div>

          <ul className="divide-y" style={{ borderColor: '#E5DED3' }}>
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid gap-1.5 px-5 py-3.5 sm:grid-cols-[1.5fr_2fr_1fr_1.1fr_1.4fr] sm:items-center sm:gap-3"
              >
                <p className="text-sm font-medium tabular-nums sm:text-left" style={{ color: INK }}>
                  <span className="text-xs uppercase tracking-wide sm:hidden" style={{ color: MUTED }}>
                    When:{' '}
                  </span>
                  {formatTimestamp(row.createdAt, timezone)}
                </p>
                <p className="truncate text-sm font-medium" style={{ color: INK }}>
                  <span className="text-xs uppercase tracking-wide sm:hidden" style={{ color: MUTED }}>
                    Dish:{' '}
                  </span>
                  {row.targetName}
                  <span className="ml-1.5 text-xs font-normal" style={{ color: MUTED }}>
                    ({row.targetType === 'combo' ? 'combo' : 'dish'})
                  </span>
                </p>
                <p className="text-sm tabular-nums sm:text-right" style={{ color: INK }}>
                  <span className="text-xs uppercase tracking-wide sm:hidden" style={{ color: MUTED }}>
                    Credit:{' '}
                  </span>
                  {row.creditDeducted.toFixed(0)} credit
                </p>
                <div className="flex items-center gap-2 sm:justify-start">
                  <StatusBadge row={row} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs uppercase tracking-wide sm:hidden" style={{ color: MUTED }}>
                    ID:{' '}
                  </span>
                  {row.generationId ? (
                    <span
                      className="break-all font-mono text-xs"
                      style={{ color: MUTED }}
                      title={row.generationId}
                    >
                      {row.generationId.length > 18
                        ? `${row.generationId.slice(0, 18)}…`
                        : row.generationId}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: MUTED }}>—</span>
                  )}
                  {row.refunded && row.status === 'failed' ? (
                    <p className="mt-0.5 text-xs font-medium" style={{ color: '#B8860B' }}>
                      1 credit refunded
                    </p>
                  ) : null}
                  {row.status === 'pending' ? (
                    <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
                      Generating…
                    </p>
                  ) : null}
                  {row.errorMessage && row.status === 'failed' ? (
                    <p className="mt-0.5 truncate text-xs" style={{ color: MUTED }} title={row.errorMessage}>
                      {row.errorMessage}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
