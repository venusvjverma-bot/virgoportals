import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Clock3, Download, Loader2, Lock, LockOpen, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { closeDepartmentSession, closureBlockedMessage, durationLabel, enqueueSessionReportPrintJob, listDepartmentSessionReports, outstandingAcceptedOrders, paymentLabelForReport, toSessionReportTicketData } from '@/lib/reports';
import { formatMinor } from '@/lib/currency';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { downloadSessionReportPdf } from '@/lib/sessionReportDownload';
import { generateSessionReportBlob } from '@/lib/sessionReportTicket';
import type { Department, DepartmentSessionReport, RestaurantPortal } from '@/types';

interface ReportsViewProps {
  restaurant: RestaurantPortal;
  departments: Department[];
}

function totalValue(report: DepartmentSessionReport): number {
  return report.orders.reduce((sum, order) => sum + order.totalMinor, 0);
}

function paymentTotals(report: DepartmentSessionReport): Map<string, number> {
  const totals = new Map<string, number>();
  for (const order of report.orders) {
    const label = paymentLabelForReport(order.paymentStatus);
    totals.set(label, (totals.get(label) ?? 0) + order.totalMinor);
  }
  return totals;
}

function dateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Running';
}

function sessionDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function sessionTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ReportsView({ restaurant, departments }: ReportsViewProps) {
  const [reports, setReports] = useState<DepartmentSessionReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printFeedback, setPrintFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await listDepartmentSessionReports(restaurant.id, departments);
      setReports(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [departments, restaurant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`reports-${restaurant.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, () => { void load(true); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, restaurant.id]);

  const runningByDepartment = useMemo(() => {
    const map = new Map<string, DepartmentSessionReport>();
    for (const report of reports) {
      if (!report.closedAt) map.set(report.departmentId, report);
    }
    return map;
  }, [reports]);

  const selected = selectedId ? reports.find((report) => report.id === selectedId) ?? null : null;
  const history = reports.filter((report) => report.closedAt);

  async function handlePrint(report: DepartmentSessionReport) {
    if (!report.closedAt || printingId) return;
    setPrintingId(report.id);
    setError(null);
    setPrintFeedback(null);
    try {
      const ticket = toSessionReportTicketData(report, restaurant.name);
      downloadSessionReportPdf(ticket, report.departmentName, report.startedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the PDF report.');
      setPrintingId(null);
      return;
    }

    try {
      await enqueueSessionReportPrintJob(report.id);
      setPrintFeedback({ tone: 'success', message: `PDF downloaded and sent to the ${report.departmentName} printer.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send the report to the printer.';
      if (message.toLowerCase().includes('no printer')) {
        setPrintFeedback({ tone: 'error', message: `The PDF was downloaded, but printing failed: no printer is configured for the ${report.departmentName} department. Set up a printer for this department to print session reports.` });
      } else {
        setPrintFeedback({ tone: 'error', message: `The PDF was downloaded, but printing failed: ${message}` });
      }
    } finally {
      setPrintingId(null);
    }
  }

  async function handleClose(report: DepartmentSessionReport) {
    if (report.closedAt || closingId) return;
    const outstanding = outstandingAcceptedOrders(report);
    if (outstanding.length > 0) {
      setError(closureBlockedMessage('session', outstanding));
      return;
    }
    if (!window.confirm(`Close the ${report.departmentName} session? New accepted orders will start a new session.`)) return;
    setClosingId(report.id);
    try {
      await closeDepartmentSession(report.id);
      await load(true);
      setSelectedId(report.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.startsWith('Cannot close this session:')) {
        setError(outstandingAcceptedOrders(report).length
          ? closureBlockedMessage('session', outstandingAcceptedOrders(report))
          : 'This session cannot be closed yet because it still contains accepted orders. Complete or cancel them first, then refresh.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not close this session.');
      }
    } finally {
      setClosingId(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-olive-600" /></div>;
  }

  if (selected) {
    const groupedPayments = paymentTotals(selected);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setSelectedId(null)} aria-label="Back to reports" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-soft ring-1 ring-cream-200 transition-colors hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-ink">{selected.departmentName}</h2>
            <p className="text-xs text-ink-muted">{selected.closedAt ? 'Closed session report' : 'Running session'}</p>
          </div>
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {printFeedback ? <Notice tone={printFeedback.tone}>{printFeedback.message}</Notice> : null}
        <div className="grid gap-3 sm:grid-cols-4">
          <Summary label="Started" value={dateTime(selected.startedAt)} />
          <Summary label="Closed" value={dateTime(selected.closedAt)} />
          <Summary label="Duration" value={durationLabel(selected.startedAt, selected.closedAt)} />
          <Summary label="Orders" value={String(selected.orders.length)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Summary label="Total order value" value={formatMinor(totalValue(selected), selected.currency)} />
          <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Payment totals</p>
            <div className="mt-2 space-y-1.5">
              {[...groupedPayments.entries()].map(([label, value]) => <div key={label} className="flex justify-between text-sm text-ink"><span>{label}</span><span className="font-semibold">{formatMinor(value, selected.currency)}</span></div>)}
              {groupedPayments.size === 0 ? <p className="text-sm text-ink-muted">No orders yet.</p> : null}
            </div>
          </div>
        </div>
        {!selected.closedAt ? <Button variant="danger" onClick={() => void handleClose(selected)} disabled={closingId === selected.id}><Lock className="h-4 w-4" />{closingId === selected.id ? 'Closing…' : 'Close session'}</Button> : null}
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-cream-200">
          <div className="border-b border-cream-200 px-4 py-3"><h3 className="text-sm font-semibold text-ink">Orders in this session</h3></div>
          {selected.orders.length === 0 ? <p className="px-4 py-8 text-center text-sm text-ink-muted">No accepted orders have joined this session yet.</p> : <div className="divide-y divide-cream-100">{selected.orders.map((order) => <div key={order.id} className="flex items-center justify-between gap-4 px-4 py-3"><div><p className="text-sm font-semibold text-ink">{order.orderNumber}</p><p className="text-xs text-ink-muted">{orderStatusLabel(order.status)} · {paymentLabelForReport(order.paymentStatus)} · {new Date(order.createdAt).toLocaleString()}</p></div><p className="text-sm font-semibold text-ink">{formatMinor(order.totalMinor, order.currency)}</p></div>)}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {printFeedback ? <Notice tone={printFeedback.tone}>{printFeedback.message}</Notice> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">Sessions begin automatically when a Department order is accepted.</p>
        <Button variant="secondary" size="sm" onClick={() => void load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Refresh</Button>
      </div>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Department sessions</h2>
        <div className="grid gap-3">{departments.map((department) => {
          const report = runningByDepartment.get(department.id);
          if (report) {
            return <div key={department.id} className="flex flex-col gap-5 rounded-2xl bg-green-50 p-5 shadow-soft ring-1 ring-green-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-ink">{department.name}</p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-success-700"><LockOpen className="h-4 w-4" />Running Session</p>
                </div>
                <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <SessionDetail label="Start date:" value={sessionDate(report.startedAt)} tone="running" />
                  <SessionDetail label="Start time:" value={sessionTime(report.startedAt)} tone="running" />
                  <SessionDetail label="Duration:" value={durationLabel(report.startedAt, report.closedAt)} tone="running" />
                  <SessionDetail label="Orders:" value={String(report.orders.length)} tone="running" />
                  <SessionDetail label="Sales:" value={formatMinor(totalValue(report), report.currency)} tone="running" />
                </div>
              </div>
              <Button variant="secondary" size="sm" className="self-start" onClick={() => setSelectedId(report.id)}>View session <ChevronRight className="h-4 w-4" /></Button>
            </div>;
          }
          return <div key={department.id} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
            <p className="font-semibold text-ink">{department.name}</p>
            <p className="mt-1 text-sm text-ink-muted">No session is active.</p>
          </div>;
        })}</div>
      </section>
      <section className="space-y-3"><h2 className="font-display text-xl font-semibold text-ink">Session history</h2>{history.length === 0 ? <div className="rounded-2xl bg-white p-6 text-sm text-ink-muted shadow-soft ring-1 ring-cream-200">Closed sessions will appear here.</div> : <div className="grid gap-3">{history.map((report) => <div key={report.id} className="flex flex-col gap-5 rounded-2xl bg-orange-50 p-5 shadow-soft ring-1 ring-orange-200"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold text-ink">{report.departmentName}</p><p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-error-700"><Lock className="h-4 w-4" />Closed Session</p></div><div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2"><SessionDetail label="Start date:" value={sessionDate(report.startedAt)} /><SessionDetail label="Start time:" value={sessionTime(report.startedAt)} /><SessionDetail label="Close date:" value={report.closedAt ? sessionDate(report.closedAt) : '—'} /><SessionDetail label="Close time:" value={report.closedAt ? sessionTime(report.closedAt) : '—'} /><SessionDetail label="Duration:" value={durationLabel(report.startedAt, report.closedAt)} /><SessionDetail label="Orders:" value={String(report.orders.length)} /><SessionDetail label="Sales:" value={formatMinor(totalValue(report), report.currency)} /></div></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => setSelectedId(report.id)}>View report <ChevronRight className="h-4 w-4" /></Button><Button variant="primary" size="sm" onClick={() => void handlePrint(report)} disabled={printingId === report.id}><Printer className="h-4 w-4" />{printingId === report.id ? 'Preparing…' : 'Print Report'}<Download className="h-3.5 w-3.5" /></Button></div></div>)}</div>}</section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200"><p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p><p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-ink"><Clock3 className="h-3.5 w-3.5 text-olive-600" />{value}</p></div>;
}

function SessionDetail({ label, value, tone = 'closed' }: { label: string; value: string; tone?: 'closed' | 'running' }) {
  return <div className={`flex items-baseline justify-between gap-4 border-b pb-1.5 ${tone === 'running' ? 'border-green-200/80' : 'border-orange-200/70'}`}><span className="text-ink-muted">{label}</span><span className="text-right font-semibold text-ink">{value}</span></div>;
}

function orderStatusLabel(status: string): string {
  switch (status) {
    case 'new': return 'New';
    case 'accepted': return 'Accepted';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}
