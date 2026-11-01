import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Phone, X } from 'lucide-react';
import {
  getOrder,
  updateOrderStatus,
  formatMinor,
  statusLabel,
  nextStatus,
  STATUS_FLOW,
} from '@/lib/orders';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';
import type { Order, OrderStatus } from '@/types';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-olive-100 text-olive-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the order status.');
    } finally {
      setUpdating(false);
    }
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
          <p className="mt-1.5 text-xs font-semibold text-warning-700">Test Payment — Not Paid</p>
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
                <p className="text-xs text-ink-muted">
                  {item.quantity} × {formatMinor(item.priceMinor, order.currency)}
                  {item.servingLabel ? <span className="text-ink-faint"> · {item.servingLabel}</span> : null}
                </p>
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
