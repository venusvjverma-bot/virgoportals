import { useEffect, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Loader2, Phone, X } from 'lucide-react';
import {
  getOrder,
  updateOrderStatus,
  markOrdersOpened,
  formatMinor,
  paymentLabel,
  statusLabel,
  nextStatus,
  STATUS_FLOW,
  getPrintJobForOrder,
  type PrintJobSummary,
} from '@/lib/orders';
import { cn } from '@/lib/cn';
import { generateTicketBlob } from '@/lib/orderTicket';
import { orderAddOnLines } from '@/lib/orderItemDetails';
import { supabase } from '@/lib/supabase';
import type { Order, OrderStatus } from '@/types';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-olive-100 text-olive-700',
  accepted: 'bg-blue-100 text-blue-700',
  completed: 'bg-cream-200 text-ink-soft',
  cancelled: 'bg-error-100 text-error-700',
};

interface OrderDetailViewProps {
  orderId: string;
  onBack: () => void;
}

export function OrderDetailView({ orderId, onBack }: OrderDetailViewProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [printJob, setPrintJob] = useState<PrintJobSummary | null>(null);

  async function load() {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the order.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [orderId]);

  useEffect(() => {
    let active = true;
    getPrintJobForOrder(orderId)
      .then((job) => { if (active) setPrintJob(job); })
      .catch(() => {});
    return () => { active = false; };
  }, [orderId, order?.statusUpdatedAt]);

  // ── Realtime: listen for status changes on this order ──
  useEffect(() => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => { void load(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  async function handleStatusChange(newStatus: OrderStatus) {
    if (!order || updating) return;
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, newStatus);
      // A status change counts as having seen the order on every device.
      void markOrdersOpened(order.restaurantId, [order.id]).catch(() => {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the order status.');
    } finally {
      setUpdating(false);
    }
  }

  function buildTicketBlob() {
    if (!order) return null;
    try {
      const blob = generateTicketBlob({
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        tipMinor: order.tipMinor,
        serviceType: order.serviceType,
        serviceLocation: order.serviceLocation,
        serviceChargeMinor: order.serviceChargeMinor,
        totalMinor: order.totalMinor,
        currency: order.currency,
        createdAt: order.createdAt,
        restaurantName: order.restaurantName,
        resourceName: order.resourceName,
        resourceType: order.resourceType,
        mobileNumber: order.mobileNumber,
        items: order.items,
      });
      setTicketError(null);
      return URL.createObjectURL(blob);
    } catch {
      setTicketError('Could not generate the ticket. Please try again.');
      return null;
    }
  }

  function openTicketInNewTab() {
    const url = buildTicketBlob();
    if (!url) return;
    // Not passing 'noopener': browsers return null when it is passed even on
    // success, which caused false "popup blocked" errors. Detach the opener
    // manually instead so the new tab cannot access this page.
    const win = window.open(url, '_blank');
    if (win) {
      win.opener = null;
      setTicketError(null);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      URL.revokeObjectURL(url);
      setTicketError('Your browser blocked the new tab. Please use Download PDF instead.');
    }
  }

  function downloadTicket() {
    const url = buildTicketBlob();
    if (!url || !order) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `order-${order.orderNumber}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setTicketError(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-olive-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-cream-200">
        <p className="text-sm text-error-600">{error ?? 'Order not found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 text-sm font-medium text-olive-700 hover:text-olive-800"
        >
          Back to orders
        </button>
      </div>
    );
  }

  const next = nextStatus(order.status);
  const created = new Date(order.createdAt);
  const statusUpdated = new Date(order.statusUpdatedAt);
  const tipDescriptor = order.tipOption === 'custom' ? 'custom amount' : `${order.tipOption}%`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to orders"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            {order.orderNumber}
          </h2>
          <p className="text-xs text-ink-muted">{created.toLocaleString()}</p>
        </div>
      </div>

      {/* Order ticket */}
      <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Order Confirmation Ticket
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTicket}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-olive-700 bg-white py-3 text-sm font-semibold text-olive-700 transition-all duration-200 hover:bg-olive-50 active:scale-[0.99]"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={openTicketInNewTab}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-olive-700 bg-white py-3 text-sm font-semibold text-olive-700 transition-all duration-200 hover:bg-olive-50 active:scale-[0.99]"
          >
            <ExternalLink className="h-4 w-4" />
            View in New Tab
          </button>
        </div>
        {ticketError ? (
          <p className="mt-2 text-xs text-error-600">{ticketError}</p>
        ) : null}
        {printJob ? (
          <div className="mt-3 border-t border-cream-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Automatic printing</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {printJob.status === 'printed'
                ? `Printed ${printJob.printedAt ? new Date(printJob.printedAt).toLocaleTimeString() : ''}`
                : printJob.status === 'failed'
                  ? 'Print failed — ticket can still be printed manually above'
                  : printJob.status === 'printing'
                    ? 'Sending to printer…'
                    : 'Queued for printing'}
            </p>
            {printJob.status === 'failed' && printJob.lastError ? (
              <p className="mt-0.5 text-xs text-error-600">{printJob.lastError}</p>
            ) : null}
            {printJob.status !== 'printed' && printJob.status !== 'failed' && printJob.attempts > 0 ? (
              <p className="mt-0.5 text-xs text-ink-muted">Retry {printJob.attempts} of 5</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Status and payment */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Order status</p>
          <span
            className={cn(
              'mt-1.5 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
              STATUS_COLORS[order.status]
            )}
          >
            {statusLabel(order.status)}
          </span>
          <p className="mt-1.5 text-xs text-ink-faint">
            Updated {statusUpdated.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Payment</p>
          <p className="mt-1.5 text-xs font-semibold text-warning-700">{paymentLabel(order.paymentStatus)}</p>
        </div>
      </div>

      {/* Restaurant / resource */}
      <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Restaurant</p>
        <p className="mt-0.5 text-sm font-semibold text-ink">{order.restaurantName}</p>
        {order.resourceName && order.resourceName !== order.restaurantName ? (
          <>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              {order.resourceType === 'event' ? 'Event' : 'Department'}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{order.resourceName}</p>
          </>
        ) : null}
      </div>

      {/* Customer mobile */}
      <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Customer mobile</p>
        {order.mobileNumber ? (
          <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
            <Phone className="h-3.5 w-3.5 text-olive-600" />
            {order.mobileNumber}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-ink-faint">No mobile number saved with this order.</p>
        )}
      </div>

      {/* Serving area */}
      {order.serviceType ? (
        <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Serving area</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {order.serviceType === 'room' ? 'Room Service' : 'Table Service'}
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-base font-bold"
              style={{ backgroundColor: '#E4E8DF', color: '#292A27' }}
            >
              {order.serviceType === 'room' ? 'Room' : 'Table'} {order.serviceLocation}
            </span>
          </p>
        </div>
      ) : null}

      {/* Items */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-cream-200">
        <div className="border-b border-cream-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Items</h3>
        </div>
        <ul className="divide-y divide-cream-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                {item.variantName ? (
                  <p className="text-xs font-medium text-olive-800">
                    Variant: {item.variantName}
                    <span className="text-ink-faint">
                      {' '}·{' '}
                      {item.variantAdditionalMinor
                        ? `+${formatMinor(item.variantAdditionalMinor, order.currency)}`
                        : 'no extra charge'}
                    </span>
                  </p>
                ) : null}
                <p className="text-xs text-ink-muted">
                  {item.quantity} × {formatMinor(item.priceMinor, order.currency)}
                  {item.servingLabel ? <span className="text-ink-faint"> · {item.servingLabel}</span> : null}
                </p>
                {item.selections && item.selections.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {item.selections.map((selection, index) => (
                      <li key={`${selection.groupId}-${index}`} className="text-xs text-ink-muted">
                        {selection.dishName}
                        {selection.servingLabel ? <span className="text-ink-faint"> · {selection.servingLabel}</span> : null}
                        {selection.removedIngredients ? <span className="text-ink-faint"> · {selection.removedIngredients}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.addOns.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {orderAddOnLines(item.addOns, order.currency).map((line) => (
                      <li key={line} className="text-xs font-medium text-olive-800">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.removedIngredients ? (
                  <p className="mt-0.5 text-xs font-medium text-ink-faint">
                    {item.removedIngredients}
                  </p>
                ) : null}
                {item.additionalRequest ? (
                  <p className="mt-0.5 whitespace-pre-line text-xs font-medium text-olive-800">
                    Request: {item.additionalRequest}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-semibold text-olive-700">
                {formatMinor(item.lineTotalMinor, order.currency)}
              </span>
            </li>
          ))}
        </ul>
        {order.tipMinor > 0 ? (
          <div className="space-y-1.5 border-t border-cream-200 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Subtotal</span>
              <span className="font-medium text-ink">{formatMinor(order.subtotalMinor, order.currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">
                Tip <span className="text-xs text-ink-faint">({tipDescriptor})</span>
              </span>
              <span className="font-medium text-ink">{formatMinor(order.tipMinor, order.currency)}</span>
            </div>
            {order.serviceType && order.serviceChargeMinor > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {order.serviceType === 'room' ? 'Room service charge' : 'Table service charge'}
                </span>
                <span className="font-medium text-ink">
                  {formatMinor(order.serviceChargeMinor, order.currency)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3">
          <span className="text-sm font-semibold text-ink">Total</span>
          <span className="font-display text-lg font-semibold text-ink">
            {formatMinor(order.totalMinor, order.currency)}
          </span>
        </div>
      </div>

      {/* Status controls */}
      {order.status !== 'cancelled' && order.status !== 'completed' ? (
        <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Update status
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {next ? (
              <button
                type="button"
                onClick={() => handleStatusChange(next)}
                disabled={updating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-olive-700 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-olive-800 active:scale-[0.99] disabled:opacity-50"
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Mark as {statusLabel(next)}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => handleStatusChange('cancelled')}
              disabled={updating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-error-600 ring-1 ring-error-200 transition-all duration-200 hover:bg-error-50 active:scale-[0.99] disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Cancel order
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
