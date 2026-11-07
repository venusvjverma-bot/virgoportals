import { useState } from 'react';
import { CheckCircle2, ConciergeBell, Save as SaveIcon, BellRing } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { parsePriceToMinor, formatMinor } from '@/lib/currency';
import { cn } from '@/lib/cn';

export interface ServiceTypeValue {
  tableServiceEnabled: boolean;
  tableServiceCharge: number;
  roomServiceEnabled: boolean;
  roomServiceCharge: number;
}

interface TypeOfServiceSectionProps {
  value: ServiceTypeValue;
  currency: string;
  onSave: (value: ServiceTypeValue) => Promise<void>;
}

function toInputValue(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function TypeOfServiceSection({ value, currency, onSave }: TypeOfServiceSectionProps) {
  const [tableEnabled, setTableEnabled] = useState(value.tableServiceEnabled);
  const [tableCharge, setTableCharge] = useState(toInputValue(value.tableServiceCharge));
  const [roomEnabled, setRoomEnabled] = useState(value.roomServiceEnabled);
  const [roomCharge, setRoomCharge] = useState(toInputValue(value.roomServiceCharge));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  function currentDraft(): ServiceTypeValue | null {
    const tableMinor = parsePriceToMinor(tableCharge);
    const roomMinor = parsePriceToMinor(roomCharge);
    if (tableEnabled && tableMinor === null) return null;
    if (roomEnabled && roomMinor === null) return null;
    return {
      tableServiceEnabled: tableEnabled,
      tableServiceCharge: tableEnabled ? (tableMinor ?? 0) : 0,
      roomServiceEnabled: roomEnabled,
      roomServiceCharge: roomEnabled ? (roomMinor ?? 0) : 0,
    };
  }

  const draft = currentDraft();
  const dirty =
    draft !== null &&
    (draft.tableServiceEnabled !== value.tableServiceEnabled ||
      draft.tableServiceCharge !== value.tableServiceCharge ||
      draft.roomServiceEnabled !== value.roomServiceEnabled ||
      draft.roomServiceCharge !== value.roomServiceCharge);

  async function handleSave() {
    setError(null);
    if (!draft) {
      setError('Enter a valid charge amount (0 or more, up to two decimals).');
      return;
    }
    setStatus('saving');
    try {
      await onSave(draft);
      setStatus('saved');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  function serviceRow(
    id: string,
    label: string,
    description: string,
    icon: React.ReactNode,
    enabled: boolean,
    setEnabled: (v: boolean) => void,
    charge: string,
    setCharge: (v: string) => void
  ) {
    return (
      <div className={cn(
        'rounded-xl p-4 ring-1 transition-colors duration-200',
        enabled ? 'bg-cream-50 ring-cream-200' : 'bg-white ring-cream-100'
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E4E8DF] text-[#58664F]">
              {icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
            </div>
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2">
            <input
              id={id}
              type="checkbox"
              checked={enabled}
              onChange={(e) => { setEnabled(e.target.checked); setStatus('idle'); }}
              className="h-4 w-4 rounded border-cream-300 text-olive-700 focus:ring-olive-500"
            />
            <span className="text-sm text-ink-muted">Enabled</span>
          </label>
        </div>
        {enabled ? (
          <div className="mt-3 flex items-center justify-end gap-3">
            <label htmlFor={`${id}-charge`} className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Additional charge
            </label>
            <input
              id={`${id}-charge`}
              type="text"
              inputMode="decimal"
              value={charge}
              onChange={(e) => { setCharge(e.target.value); setStatus('idle'); }}
              placeholder="0.00"
              className="w-28 rounded-lg border border-cream-200 bg-white px-3 py-2 text-right text-sm text-ink shadow-inner outline-none transition-colors focus:border-olive-500 focus:ring-1 focus:ring-olive-500"
            />
            <span className="text-xs text-ink-faint">
              {formatMinor(parsePriceToMinor(charge) ?? 0, currency)}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="animate-fade-in">
      <h3 className="font-display text-lg font-semibold text-ink">Type of Service</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Choose which service types guests can order here, and set an optional
        additional charge for each.
      </p>

      <div className="mt-4 space-y-3">
        {serviceRow(
          'tos-table',
          'Table Service',
          'Guests order to their table via the QR code.',
          <ConciergeBell className="h-5 w-5" />,
          tableEnabled,
          setTableEnabled,
          tableCharge,
          setTableCharge
        )}
        {serviceRow(
          'tos-room',
          'Room Service',
          'Guests order to their room via the QR code.',
          <BellRing className="h-5 w-5" />,
          roomEnabled,
          setRoomEnabled,
          roomCharge,
          setRoomCharge
        )}
      </div>

      {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || status === 'saving'}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
          style={{ backgroundColor: '#3E5039' }}
        >
          <SaveIcon className="h-4 w-4" />
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {status === 'saved' ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-600">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        ) : null}
      </div>
    </Card>
  );
}
