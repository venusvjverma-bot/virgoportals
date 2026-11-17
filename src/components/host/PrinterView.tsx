import { useState } from 'react';
import { CheckCircle2, Loader2, Printer, Save, Send, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { updateDepartment } from '@/lib/departments';
import type { Department } from '@/types';

interface PrinterViewProps {
  department: Department;
  onSaved: () => void;
}

const CONNECTION_OPTIONS: { value: 'wifi' | 'lan'; label: string }[] = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'lan', label: 'LAN' },
];

interface PrintAgentRow {
  id: string;
  department_ids: string[] | null;
  last_heartbeat_at: string | null;
}

const HEARTBEAT_ONLINE_MINUTES = 3;

function printerAppOnline(lastHeartbeatAt: string | null): boolean {
  if (!lastHeartbeatAt) return false;
  return Date.now() - new Date(lastHeartbeatAt).getTime() < HEARTBEAT_ONLINE_MINUTES * 60_000;
}

export function PrinterView({ department, onSaved }: PrinterViewProps) {
  const [enabled, setEnabled] = useState(department.printerEnabled);
  const [name, setName] = useState(department.printerName ?? '');
  const [connection, setConnection] = useState<'wifi' | 'lan'>(department.printerConnection ?? 'wifi');
  const [ip, setIp] = useState(department.printerIp ?? '');
  const [port, setPort] = useState(department.printerPort !== null ? String(department.printerPort) : '9100');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [appOnline, setAppOnline] = useState<boolean | null>(null);
  const [appChecked, setAppChecked] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function checkPrintingApp() {
    try {
      const { data, error: queryError } = await supabase
        .from('print_agents')
        .select('id, department_ids, last_heartbeat_at');
      if (queryError) throw queryError;
      const rows = (data ?? []) as PrintAgentRow[];
      setAppOnline(rows.some((row) => (row.department_ids ?? []).includes(department.id) && printerAppOnline(row.last_heartbeat_at)));
      setAppChecked(true);
    } catch {
      setAppOnline(false);
      setAppChecked(true);
    }
  }

  async function sendTestPrint() {
    setTestResult(null);
    setTestSending(true);
    try {
      const { data: jobId, error: rpcError } = await supabase.rpc('enqueue_department_test_print', {
        p_department_id: department.id,
      });
      if (rpcError) throw rpcError;
      setTestResult({ ok: true, message: 'Test ticket sent. It should print within a few seconds if the printing app is connected and the printer is on.' });
      window.setTimeout(() => setTestResult(null), 8000);
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Could not send the test print.' });
    } finally {
      setTestSending(false);
    }
  }

  function validate(): string | null {
    if (enabled && !name.trim()) return 'Enter a printer name.';
    if (enabled && !ip.trim()) return 'Enter the printer IP address.';
    if (enabled && ip.trim()) {
      const parts = ip.trim().split('.');
      const valid =
        parts.length === 4 &&
        parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
      if (!valid) return 'Enter a valid IPv4 address, e.g. 192.168.1.50.';
    }
    if (enabled && port.trim()) {
      const portNum = Number(port.trim());
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        return 'Enter a valid port between 1 and 65535.';
      }
    }
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    setSaved(false);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateDepartment(department.id, {
        printerEnabled: enabled,
        printerName: name.trim() || null,
        printerConnection: enabled ? connection : null,
        printerIp: enabled ? ip.trim() : null,
        printerPort: enabled && port.trim() ? Number(port.trim()) : null,
      });
      setSaved(true);
      onSaved();
      window.setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save printer settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[22px] bg-white p-5 shadow-soft ring-1 ring-cream-200 sm:p-6">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: '#E4E8DF', color: '#58664F' }}
          >
            <Printer className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold text-ink">Receipt printer</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Configure which receipt printer this department's order tickets are sent to. Paper width is 80 mm.
            </p>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-center justify-between rounded-xl bg-cream-50 px-4 py-3.5">
          <span className="text-sm font-medium text-ink">Enable printer</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); setError(null); setSaved(false); }}
            className="h-5 w-5 accent-olive-700"
          />
        </label>

        {enabled ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Printer name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); setSaved(false); }}
                placeholder="e.g. Bar printer"
                className="mt-1.5 w-full rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-olive-600"
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Connection type</label>
              <div className="mt-1.5 flex gap-2">
                {CONNECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setConnection(opt.value); setError(null); setSaved(false); }}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                      connection === opt.value
                        ? 'bg-olive-700 text-white shadow-soft'
                        : 'bg-cream-50 text-ink-muted hover:bg-cream-100 hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">IP address</label>
                <input
                  type="text"
                  value={ip}
                  onChange={(e) => { setIp(e.target.value); setError(null); setSaved(false); }}
                  placeholder="192.168.1.50"
                  className="mt-1.5 w-full rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-olive-600"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Port {connection === 'lan' ? '(required)' : '(optional)'}
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => { setPort(e.target.value); setError(null); setSaved(false); }}
                  placeholder="9100"
                  className="mt-1.5 w-full rounded-xl border border-cream-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-olive-600"
                />
              </div>
            </div>

            <p className="text-xs text-ink-faint">
              Paper width is fixed at 80 mm. Wi-Fi printers connect through the local wireless network;
              LAN printers connect through a network cable. Both need an IP address on the same network
              as the device printing the tickets.
            </p>

            <div className="rounded-xl bg-cream-50 px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {appChecked && appOnline ? (
                    <CheckCircle2 className="h-5 w-5 text-success-600" />
                  ) : appChecked ? (
                    <XCircle className="h-5 w-5 text-ink-faint" />
                  ) : null}
                  <p className="text-sm font-medium text-ink">
                    {!appChecked
                      ? 'Printing app status not checked yet'
                      : appOnline
                        ? 'Printing app connected for this department'
                        : 'Printing app not connected for this department'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={checkPrintingApp}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-white hover:text-ink"
                >
                  Check status
                </button>
              </div>
              {appChecked && !appOnline ? (
                <p className="mt-2 text-xs text-ink-faint">
                  Install the printing app from Printer Setup in the menu on the left and tick this
                  department for that computer.
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={sendTestPrint}
                disabled={testSending}
                className="inline-flex items-center gap-2 rounded-xl bg-cream-100 px-5 py-2.5 text-sm font-semibold text-ink shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:bg-cream-200 active:scale-[0.99] disabled:opacity-50"
              >
                {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {testSending ? 'Sending…' : 'Send test print'}
              </button>
              {testResult ? (
                <p
                  className={`text-sm font-medium ${testResult.ok ? 'text-success-600' : 'text-error-600'}`}
                >
                  {testResult.message}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">
            Printing is disabled for this department. Order tickets can still be opened and printed
            manually from the order screen.
          </p>
        )}

        {error ? (
          <p className="mt-4 text-sm font-medium text-error-600">{error}</p>
        ) : null}
        {saved ? (
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-success-600">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </p>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-olive-700 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-olive-800 active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save printer settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
