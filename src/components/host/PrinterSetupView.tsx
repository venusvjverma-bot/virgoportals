import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, Monitor, Printer, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Department, RestaurantPortal } from '@/types';

interface PrintAgentRow {
  id: string;
  name: string;
  app_version: string | null;
  department_ids: string[] | null;
  last_heartbeat_at: string | null;
}

interface PrinterSetupViewProps {
  restaurant: RestaurantPortal;
  departments: Department[];
  onOpenDepartment: (dept: Department) => void;
}

const HEARTBEAT_ONLINE_MINUTES = 3;

function isOnline(lastHeartbeatAt: string | null): boolean {
  if (!lastHeartbeatAt) return false;
  return Date.now() - new Date(lastHeartbeatAt).getTime() < HEARTBEAT_ONLINE_MINUTES * 60_000;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export function PrinterSetupView({ restaurant, departments, onOpenDepartment }: PrinterSetupViewProps) {
  const [agents, setAgents] = useState<PrintAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('print_agents')
        .select('id, name, app_version, department_ids, last_heartbeat_at')
        .order('created_at', { ascending: true });
      if (queryError) throw queryError;
      setAgents((data ?? []) as PrintAgentRow[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load printing app status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    const timer = window.setInterval(loadAgents, 30_000);
    return () => window.clearInterval(timer);
  }, [loadAgents]);

  async function toggleDepartment(agent: PrintAgentRow, departmentId: string) {
    const current = agent.department_ids ?? [];
    const next = current.includes(departmentId)
      ? current.filter((id) => id !== departmentId)
      : [...current, departmentId];
    setSavingAgentId(agent.id);
    try {
      const { error: updateError } = await supabase
        .from('print_agents')
        .update({ department_ids: next })
        .eq('id', agent.id);
      if (updateError) throw updateError;
      setAgents((rows) => rows.map((row) => (row.id === agent.id ? { ...row, department_ids: next } : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the departments this computer serves.');
    } finally {
      setSavingAgentId(null);
    }
  }

  const installable = departments.filter((dept) => dept.printerEnabled && dept.printerIp);

  return (
    <div className="space-y-5">
      {/* Step 1 — download & install */}
      <section className="rounded-[22px] bg-white p-5 shadow-soft ring-1 ring-cream-200 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-olive-700">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-ink">1. Install the printing app</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Download the Virgo printing app on the Windows computer that shares a network with your
              receipt printers. Run the installer once — the app then starts by itself whenever the
              computer is on and stays in the background.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a
            href="/downloads/virgo-printing-app-windows.zip"
            download
            className="inline-flex items-center gap-2 rounded-xl bg-olive-700 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-olive-800 active:scale-[0.99]"
          >
            <Download className="h-4 w-4" />
            Download for Windows
          </a>
          <span className="text-xs text-ink-faint">Windows 10 or 11 · No technical setup needed</span>
        </div>

        <ol className="mt-5 space-y-2.5 text-sm text-ink-muted">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-100 text-[11px] font-semibold text-olive-700">1</span>
            Download the app on the computer near your printers and run the installer.
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-100 text-[11px] font-semibold text-olive-700">2</span>
            When asked, sign in with this Virgo Portal account (the same email and password you use here).
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-100 text-[11px] font-semibold text-olive-700">3</span>
            Tick the departments this computer prints for. You can change this any time below.
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-100 text-[11px] font-semibold text-olive-700">4</span>
            The app stays in the background and prints order tickets automatically.
          </li>
        </ol>
        <p className="mt-4 text-xs text-ink-faint">
          You can install the app on more than one computer — for example one per floor or bar.
        </p>
      </section>

      {/* Step 2 — connection status */}
      <section className="rounded-[22px] bg-white p-5 shadow-soft ring-1 ring-cream-200 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-olive-700">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">2. Connection status</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Computers running the printing app for {restaurant.name || 'your restaurant'}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAgents}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-cream-50 hover:text-ink"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
            Checking for installed apps…
          </div>
        ) : agents.length === 0 ? (
          <div className="mt-5 rounded-xl bg-cream-50 px-4 py-4 text-sm text-ink-muted">
            No computers are connected yet. Install the app above and sign in — it will appear here
            within a minute.
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {agents.map((agent) => {
              const online = isOnline(agent.last_heartbeat_at);
              return (
                <li key={agent.id} className="rounded-xl bg-cream-50 px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {online ? (
                        <CheckCircle2 className="h-4.5 w-4.5 h-5 w-5 text-success-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-ink-faint" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-ink">{agent.name}</p>
                        <p className="text-xs text-ink-faint">
                          {online ? 'Connected' : 'Not connected'} · Last seen {timeAgo(agent.last_heartbeat_at)}
                          {agent.app_version ? ` · Version ${agent.app_version}` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        online ? 'bg-success-50 text-success-700' : 'bg-cream-200 text-ink-muted'
                      }`}
                    >
                      {online ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Step 3 — choose departments per computer */}
      <section className="rounded-[22px] bg-white p-5 shadow-soft ring-1 ring-cream-200 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-olive-700">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">3. Choose which departments each computer prints for</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Tick the departments each computer serves. New departments appear here automatically —
              just tick them when you add one. Each department's printer address is set in its own
              Printer tab.
            </p>
          </div>
        </div>

        {agents.length === 0 ? (
          <p className="mt-5 rounded-xl bg-cream-50 px-4 py-4 text-sm text-ink-muted">
            Install and sign in to the app first — then you can pick its departments here or in the app.
          </p>
        ) : installable.length === 0 ? (
          <p className="mt-5 rounded-xl bg-cream-50 px-4 py-4 text-sm text-ink-muted">
            No department has a printer enabled yet. Open a department, go to its Printer tab, enable
            the printer and enter its IP address.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-xl bg-cream-50 px-4 py-4">
                <p className="text-sm font-medium text-ink">{agent.name}</p>
                <ul className="mt-3 space-y-1.5">
                  {installable.map((dept) => {
                    const checked = (agent.department_ids ?? []).includes(dept.id);
                    return (
                      <li key={dept.id}>
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-white px-3.5 py-2.5">
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-ink">{dept.name}</span>
                            <span className="block text-xs text-ink-faint">
                              {dept.printerName ?? 'Printer'} · {dept.printerIp}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={savingAgentId === agent.id}
                            onChange={() => toggleDepartment(agent, dept.id)}
                            className="h-5 w-5 shrink-0 accent-olive-700"
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Step 4 — per-department configuration pointer */}
      <section className="rounded-[22px] bg-white p-5 shadow-soft ring-1 ring-cream-200 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-ink">4. Set up each printer</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Each department keeps its own printer settings — name, connection type, IP address and port —
          in its Printer tab, together with a connection check and a test print.
        </p>
        {departments.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {departments.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => onOpenDepartment(dept)}
                className="inline-flex items-center gap-2 rounded-xl bg-cream-50 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
              >
                <Printer className="h-4 w-4 text-olive-600" />
                {dept.name}
                {dept.printerEnabled && dept.printerIp ? (
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                ) : (
                  <span className="text-xs text-ink-faint">Not set up</span>
                )}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="text-sm font-medium text-error-600">{error}</p>
      ) : null}
    </div>
  );
}
