import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Notice } from '@/components/ui/Notice';
import { buildDailyUsage, formatCredits, type DailyUsage } from '@/lib/dailyTokenUsage';
import { getLlmUsageDaily } from '@/lib/portal';
import { formatTokenCount } from '@/lib/formatTokens';
import type { RestaurantPortal } from '@/types';

const BAR_COLOR = '#E8833A';
const BASELINE_COLOR = '#6E7B62';
const REFERENCE_COLOR = '#B4BDAB';
const INK = '#292A27';
const MUTED = '#77766F';

interface DailyTokenChartProps {
  portal: RestaurantPortal;
}

export function DailyTokenChart({ portal }: DailyTokenChartProps) {
  const timezone = portal.timezone || 'UTC';
  const [days, setDays] = useState<DailyUsage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await getLlmUsageDaily(portal.id);
        if (active) setDays(buildDailyUsage(rows));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load daily usage.');
      }
    })();
    return () => {
      active = false;
    };
  }, [portal.id]);

  const peak = days ? Math.max(0, ...days.map((day) => day.totalTokens)) : 0;

  return (
    <section
      className="mt-4 overflow-hidden rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5DED3' }}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="font-display text-lg font-semibold tracking-tight" style={{ color: INK }}>
          Daily Token Consumption
        </h3>
        <p className="text-xs" style={{ color: MUTED }}>
          Last 7 days · {timezone}
        </p>
      </div>

      {error ? (
        <Notice tone="error" className="mt-4">{error}</Notice>
      ) : !days ? (
        <div className="mt-6 flex items-center gap-2 text-sm" style={{ color: MUTED }}>
          <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
          Loading daily usage…
        </div>
      ) : (
        <>
          <div className="relative mt-4 h-52 sm:h-64">
            <div className="absolute inset-x-0 top-8 bottom-0">
              <div
                className="absolute inset-x-0 top-0 border-t border-dashed"
                style={{ borderColor: REFERENCE_COLOR }}
              />
              <div
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ backgroundColor: BASELINE_COLOR }}
              />
              <div className="grid h-full grid-cols-7 gap-1.5 sm:gap-3">
                {days.map((day) => {
                  const heightPct = peak > 0 ? (day.totalTokens / peak) * 100 : 0;
                  return (
                    <div key={day.dateKey} className="relative h-full min-w-0">
                      <span
                        className="absolute inset-x-0 text-center text-[10px] font-semibold tabular-nums sm:text-xs"
                        style={{ bottom: `calc(${heightPct}% + 6px)`, color: INK }}
                        title={`${day.totalTokens.toLocaleString()} tokens`}
                      >
                        {formatTokenCount(day.totalTokens)}
                      </span>
                      <div
                        className="absolute bottom-0 left-1/2 w-3/5 max-w-[44px] -translate-x-1/2 rounded-t-md transition-[height] duration-500 ease-out hover:brightness-95"
                        style={{
                          height: `${heightPct}%`,
                          minHeight: day.totalTokens > 0 ? 3 : 0,
                          backgroundColor: BAR_COLOR,
                        }}
                        title={`${day.totalTokens.toLocaleString()} tokens`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1.5 text-center sm:gap-3">
            {days.map((day) => (
              <div key={day.dateKey} className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: INK }}>{day.weekday}</p>
                <p className="text-[10px] sm:text-xs" style={{ color: MUTED }}>{day.dayLabel}</p>
                <p className="mt-1 text-[10px] font-medium tabular-nums sm:text-xs" style={{ color: INK }}>
                  {formatCredits(day.credits)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
