export const TOKENS_PER_CREDIT = 900000;

export interface DailyUsageRow {
  usageDate: string;
  inputTokens: number;
  outputTokens: number;
}

export interface DailyUsage {
  dateKey: string;
  weekday: string;
  dayLabel: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  credits: number;
}

export function formatCredits(credits: number): string {
  return `${credits.toFixed(1)} cr`;
}

export function buildDailyUsage(rows: DailyUsageRow[]): DailyUsage[] {
  return rows.map((row) => {
    const totalTokens = row.inputTokens + row.outputTokens;
    const labelDate = new Date(`${row.usageDate}T12:00:00Z`);
    return {
      dateKey: row.usageDate,
      weekday: labelDate.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      dayLabel: labelDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens,
      credits: totalTokens / TOKENS_PER_CREDIT,
    };
  });
}
