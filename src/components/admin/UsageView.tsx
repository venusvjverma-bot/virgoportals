import { Card } from '@/components/ui/Card';
import type { UsageRow } from '@/types';

interface UsageViewProps {
  rows: UsageRow[];
}

export function UsageView({ rows }: UsageViewProps) {
  const totals = rows.reduce(
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
        <div className="border-b border-cream-200 px-6 py-5">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Usage</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Activity across every restaurant portal this month.
          </p>
        </div>

        <div className="overflow-x-auto scrollbar-soft">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/60">
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Host
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Uploads
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Images
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Visitor messages
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
      </Card>
    </div>
  );
}
