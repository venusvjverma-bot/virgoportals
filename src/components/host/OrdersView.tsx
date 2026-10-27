import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, ShoppingBag, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  listOrders,
  updateOrderStatus,
  formatMinor,
  statusLabel,
  nextStatus,
  STATUS_FLOW,
} from '@/lib/orders';
import type { Order, OrderStatus, RestaurantPortal } from '@/types';
import { cn } from '@/lib/cn';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-olive-100 text-olive-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
  completed: 'bg-cream-200 text-ink-soft',
  cancelled: 'bg-error-100 text-error-700',
};

function openedOrdersKey(restaurantId: string): string {
  return `vp:host:opened-orders:${restaurantId}`;
}

function loadOpenedOrderIds(restaurantId: string): Set<string> {
  try {
    const raw = localStorage.getItem(openedOrdersKey(restaurantId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveOpenedOrderIds(restaurantId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(openedOrdersKey(restaurantId), JSON.stringify([...ids]));
  } catch {
    // Ignore quota errors
  }
}

interface OrdersViewProps {
  restaurant: RestaurantPortal;
  onOpenOrder: (order: Order) => void;
}

export function OrdersView({ restaurant, onOpenOrder }: OrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [openedIds, setOpenedIds] = useState<Set<string>>(() => loadOpenedOrderIds(restaurant.id));

  const hasLoadedRef = useRef(false);
  const loadingRef = useRef(false);
  const pendingRef = useRef(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelHealthyRef = useRef(false);
  const channelGenRef = useRef(0);

  const load = useCallback(async () => {
    if (loadingRef.current) {
      pendingRef.current = true;
      return;
    }
    loadingRef.current = true;
    try {
      const data = await listOrders(restaurant.id);
      setOrders(data);
      setError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      if (!hasLoadedRef.current) {
        setError(err instanceof Error ? err.message : 'Could not load orders.');
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
      if (pendingRef.current) {
        pendingRef.current = false;
        void load();
      }
    }
  }, [restaurant.id]);

  useEffect(() => {
    load();
  }, [load]);

  const subscribeOrders = useCallback(() => {
    const gen = channelGenRef.current;

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => { void load(); }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => { void load(); }
      )
      .subscribe((status) => {
        if (gen !== channelGenRef.current) return;
        if (status === 'SUBSCRIBED') {
          channelHealthyRef.current = true;
          return;
        }
        channelHealthyRef.current = false;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          void load();
        }
      });

    channelRef.current = channel;
    channelHealthyRef.current = false;
  }, [restaurant.id, load]);

  const recreateSubscription = useCallback(() => {
    channelGenRef.current += 1;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    subscribeOrders();
  }, [subscribeOrders]);

  // ── Realtime subscription (initial mount) ──
  useEffect(() => {
    subscribeOrders();
    return () => {
      channelGenRef.current += 1;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribeOrders]);

  // ── Recover on tab visibility ──
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      void load();
      if (!channelHealthyRef.current) {
        recreateSubscription();
        void load();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load, recreateSubscription]);

  function handleOpenOrder(order: Order) {
    if (!openedIds.has(order.id)) {
      const next = new Set(openedIds);
      next.add(order.id);
      setOpenedIds(next);
      saveOpenedOrderIds(restaurant.id, next);
    }
    onOpenOrder(order);
  }

  const unopenedCount = orders.filter((o) => !openedIds.has(o.id)).length;

  const filtered = filter === 'all'
    ? orders
    : orders.filter((o) => o.status === filter);

  const counts = {
    new: orders.filter((o) => o.status === 'new').length,
    inProgress: orders.filter((o) => ['accepted', 'preparing', 'ready'].includes(o.status)).length,
    completed: orders.filter((o) => o.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-olive-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-soft ring-1 ring-cream-200">
        <p className="text-sm text-error-600">{error}</p>
        <button
          type="button"
          onClick={() => { setError(null); setLoading(true); void load(); }}
          className="mt-3 text-sm font-medium text-olive-700 hover:text-olive-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unopened counter */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full bg-olive-500',
            unopenedCount > 0 && 'animate-pulse-dot'
          )}
        />
        <span className="text-sm font-medium text-olive-700">
          {unopenedCount} {unopenedCount === 1 ? 'order' : 'orders'} unopened
        </span>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <CountCard label="New" value={counts.new} color="bg-olive-100 text-olive-700" />
        <CountCard label="In progress" value={counts.inProgress} color="bg-amber-100 text-amber-700" />
        <CountCard label="Completed" value={counts.completed} color="bg-cream-200 text-ink-soft" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterButton>
        {STATUS_FLOW.map((status) => (
          <FilterButton
            key={status}
            active={filter === status}
            onClick={() => setFilter(status)}
          >
            {statusLabel(status)}
          </FilterButton>
        ))}
        <FilterButton active={filter === 'cancelled'} onClick={() => setFilter('cancelled')}>
          Cancelled
        </FilterButton>
      </div>

      {/* Order list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 shadow-soft ring-1 ring-cream-200">
          <ShoppingBag className="h-10 w-10 text-cream-300" />
          <p className="mt-3 text-sm text-ink-muted">No orders here yet.</p>
          <p className="mt-1 text-xs text-ink-faint">
            Incoming test orders from visitors will appear here automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((order) => {
            const isOpened = openedIds.has(order.id);
            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => handleOpenOrder(order)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-2xl p-4 text-left shadow-soft ring-1 transition-all duration-200 hover:shadow-lift hover:ring-olive-200 active:scale-[0.99] sm:p-5',
                    isOpened
                      ? 'bg-white ring-cream-200'
                      : 'bg-olive-50 ring-olive-200'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-olive-700">
                        {order.orderNumber}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                          STATUS_COLORS[order.status]
                        )}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      {' · '}
                      {formatMinor(order.totalMinor, order.currency)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CountCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
      <div className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', color)}>
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-olive-700 text-white shadow-soft'
          : 'bg-white text-ink-soft ring-1 ring-cream-200 hover:ring-olive-200 hover:text-ink'
      )}
    >
      {children}
    </button>
  );
}

export { nextStatus, updateOrderStatus, statusLabel, STATUS_FLOW, STATUS_COLORS };
