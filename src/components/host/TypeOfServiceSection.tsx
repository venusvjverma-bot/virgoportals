import { useState } from 'react';
import { CheckCircle2, ConciergeBell, Pencil, Save as SaveIcon, BellRing } from 'lucide-react';
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
  // Nothing configured yet (no service enabled) → start in edit mode so the
  // host can set the section up; otherwise behave like Department Information:
  // read-only display with an Edit button.
  const [mode, setMode] = useState<'read' | 'edit'>(
    value.tableServiceEnabled || value.roomServiceEnabled ? 'read' : 'edit'
  );
  const [tableEnabled, setTableEnabled] = useState(value.tableServiceEnabled);
  const [tableCharge, setTableCharge] = useState(toInputValue(value.tableServiceCharge));
  const [roomEnabled, setRoomEnabled] = useState(value.roomServiceEnabled);
  const [roomCharge, setRoomCharge] = useState(toInputValue(value.roomServiceCharge));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  function syncFromValue() {
    setTableEnabled(value.tableServiceEnabled);
    setTableCharge(toInputValue(value.tableServiceCharge));
    setRoomEnabled(value.roomServiceEnabled);
    setRoomCharge(toInputValue(value.roomServiceCharge));
  }

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

  function handleEdit() {
    syncFromValue();
    setError(null);
    setStatus('idle');
    setMode('edit');
  }

  function handleCancel() {
    syncFromValue();
    setError(null);
    setStatus('idle');
    setMode('read');
  }

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
      setMode('read');
    } catch (err) {
      // Keep the section editable so the host can retry.
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

  function readRow(
    label: string,
    description: string,
    icon: React.ReactNode,
    enabled: boolean,
    chargeMinor: number,
    last?: boolean
  ) {
    return (
      <>
        <div className="flex items-start gap-3 py-4 first:pt-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E4E8DF] text-[#58664F]">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
            <p className="mt-1 text-sm text-ink">{description}</p>
          </div>
          <div className="shrink-0 text-right">
            <span
              className="inline-flex items-center rounded-full text-[13px] font-medium"
              style={{
                backgroundColor: enabled ? '#E4E8DF' : '#EFEEE9',
                color: enabled ? '#465641' : '#68675F',
                padding: '6px 12px',
              }}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
            {enabled ? (
              <p className="mt-1.5 text-sm tabular-nums text-ink">
                {formatMinor(chargeMinor, currency)}
              </p>
            ) : null}
          </div>
        </div>
        {!last ? <div style={{ height: '1px', backgroundColor: '#EEE9E1' }} /> : null}
      </>
    );
  }

  return (
    <Card className="animate-fade-in">
      <h3 className="font-display text-lg font-semibold text-ink">Type of Service</h3>
      {mode === 'read' ? (
        <>
          <p className="mt-1 text-sm text-ink-muted">
            Service types guests can order here, and their additional charges.
          </p>
          <div className="mt-2 divide-y divide-transparent">
            {readRow(
              'Table Service',
              'Guests order to their table via the QR code.',
              <ConciergeBell className="h-5 w-5" />,
              value.tableServiceEnabled,
              value.tableServiceCharge
            )}
            {readRow(
              'Room Service',
              'Guests order to their room via the QR code.',
              <BellRing className="h-5 w-5" />,
              value.roomServiceEnabled,
              value.roomServiceCharge,
              true
            )}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleEdit}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-colors hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4DED3', color: '#59664F' }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            {status === 'saved' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-600">
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <>
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
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-400 focus-visible:ring-offset-2"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5DED3', color: '#292A27' }}
            >
              Cancel
            </button>
            {status === 'saved' ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-600">
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </span>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}
