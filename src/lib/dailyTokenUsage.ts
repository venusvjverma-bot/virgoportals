export const TOKENS_PER_CREDIT = 900000;

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_COUNT = 7;

export interface UsageRow {
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
}

export interface DailyUsage {
  dateKey: string;
  weekday: string;
  dayLabel: string;
  totalTokens: number;
  credits: number;
}

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayKeyFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dayKeyFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Calendar date (YYYY-MM-DD) of an instant as seen on a clock in the given timezone. */
export function localDateKey(instant: Date, timeZone: string): string {
  return dayKeyFormatter(timeZone).format(instant);
}

/** The latest seven calendar dates ending today, oldest first. */
export function lastSevenDateKeys(now: Date, timeZone: string): string[] {
  const [year, month, day] = localDateKey(now, timeZone).split('-').map(Number);
  const todayUtc = Date.UTC(year, month - 1, day);
  return Array.from({ length: DAY_COUNT }, (_, index) =>
    new Date(todayUtc - (DAY_COUNT - 1 - index) * DAY_MS).toISOString().slice(0, 10)
  );
}

/**
 * Earliest instant that can still fall inside the seven-day window. Eight days
 * back covers any timezone offset, and rows are then bucketed exactly by date.
 */
export function windowStart(now: Date): Date {
  return new Date(now.getTime() - (DAY_COUNT + 1) * DAY_MS);
}

export function formatCredits(credits: number): string {
  return `${credits.toFixed(1)} cr`;
}

export function buildDailyUsage(rows: UsageRow[], now: Date, timeZone: string): DailyUsage[] {
  const dateKeys = lastSevenDateKeys(now, timeZone);
  const totals = new Map(dateKeys.map((key) => [key, 0]));

  for (const row of rows) {
    const key = localDateKey(new Date(row.createdAt), timeZone);
    const current = totals.get(key);
    if (current === undefined) continue;
    totals.set(key, current + row.inputTokens + row.outputTokens);
  }

  return dateKeys.map((dateKey) => {
    const totalTokens = totals.get(dateKey) ?? 0;
    const labelDate = new Date(`${dateKey}T12:00:00Z`);
    return {
      dateKey,
      weekday: labelDate.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      dayLabel: labelDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      totalTokens,
      credits: totalTokens / TOKENS_PER_CREDIT,
    };
  });
}
