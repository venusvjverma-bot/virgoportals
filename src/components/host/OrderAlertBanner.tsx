import { useEffect } from 'react';
import { BellRing, ChevronRight } from 'lucide-react';
import { formatMinor } from '@/lib/orders';
import type { Order } from '@/types';

const ORDER_ALERT_DURATION_MS = 4000;

interface OrderAlertBannerProps {
  order: Order;
  scopeTitle: string;
  onOpen: (order: Order) => void;
  onDismiss: (orderId: string) => void;
}

export function OrderAlertBanner({ order, scopeTitle, onOpen, onDismiss }: OrderAlertBannerProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(order.id), ORDER_ALERT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [order.id, onDismiss]);

  return (
    <button
      type="button"
      onClick={() => {
        onDismiss(order.id);
        onOpen(order);
      }}
      className="flex w-full animate-fade-in items-center gap-3 rounded-2xl bg-orange-700 px-4 py-3 text-left text-white shadow-lift transition-colors duration-200 hover:bg-orange-800"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <BellRing className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">New order {order.orderNumber}</span>
        <span className="block truncate text-xs text-white/90">
          {scopeTitle} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {formatMinor(order.totalMinor, order.currency)}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/90" />
    </button>
  );
}
