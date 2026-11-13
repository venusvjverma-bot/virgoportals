import { useEffect, useState, useCallback, useRef, type RefObject } from 'react';
import { Loader2, ShoppingBag, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  listOrders,
  updateOrderStatus,
  markOrdersOpened,
  formatMinor,
  statusLabel,
  nextStatus,
  STATUS_FLOW,
  groupOrdersByScope,
  orderScopeTitle,
} from '@/lib/orders';
import { listDepartments } from '@/lib/departments';
import { listEvents } from '@/lib/events';
import { playAlertPing } from '@/lib/orderAlertSound';
import { OrderAlertBanner } from '@/components/host/OrderAlertBanner';
import type { Department, EventItem, Order, OrderStatus, RestaurantPortal } from '@/types';
import { cn } from '@/lib/cn';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-olive-100 text-olive-700',
  accepted: 'bg-blue-100 text-blue-700',
  completed: 'bg-cream-200 text-ink-soft',
  cancelled: 'bg-error-100 text-error-700',
};

function locationFilterKey(restaurantId: string): string {
  return `vp:host:orders-location-filter:${restaurantId}`;
}

function loadLocationFilter(restaurantId: string): 'all' | Set<string> {
  try {
    const raw = localStorage.getItem(locationFilterKey(restaurantId));
    if (!raw) return 'all';
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return 'all';
    return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    return 'all';
  }
}

function saveLocationFilter(restaurantId: string, filter: 'all' | Set<string>): void {
  try {
    localStorage.setItem(
      locationFilterKey(restaurantId),
      JSON.stringify(filter === 'all' ? [] : [...filter])
    );
  } catch {
    // Ignore quota errors
  }
}

interface OrdersViewProps {
  restaurant: RestaurantPortal;
  onOpenOrder: (order: Order) => void;
  alertAudioRef: RefObject<AudioContext | null>;
}

export function OrdersView({ restaurant, onOpenOrder, alertAudioRef }: OrdersViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<'all' | Set<string>>(
    () => loadLocationFilter(restaurant.id)
  );
  const [openedIds, setOpenedIds] = useState<Set<string>>(() => new Set());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [alerts, setAlerts] = useState<Order[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set());

  const hasLoadedRef = useRef(false);
  const loadingRef = useRef(false);
  const pendingRef = useRef(false);
  const seenOrderIdsRef = useRef<Set<string> | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelHealthyRef = useRef(false);
  const channelGenRef = useRef(0);

  const dismissAlert = useCallback((orderId: string) => {
    setAlerts((current) => current.filter((order) => order.id !== orderId));
  }, []);

  const load = useCallback(async () => {
    if (loadingRef.current) {
      pendingRef.current = true;
      return;
    }
    loadingRef.current = true;
    try {
      const [data, openedRows] = await Promise.all([
        listOrders(restaurant.id),
        supabase
          .from('order_opens')
          .select('order_id')
          .eq('restaurant_id', restaurant.id),
      ]);
      setOrders(data);
      setOpenedIds(
        new Set((openedRows.data ?? []).map((row) => row.order_id as string))
      );
      setError(null);
      hasLoadedRef.current = true;

      const seen = seenOrderIdsRef.current;
      if (seen) {
        const fresh = data.filter((order) => !seen.has(order.id));
        if (fresh.length > 0) {
          setAlerts((current) => [...current, ...fresh]);
          if (alertAudioRef.current) playAlertPing(alertAudioRef.current);
        }
      }
      seenOrderIdsRef.current = new Set(data.map((order) => order.id));
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
  }, [restaurant.id, alertAudioRef]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    Promise.all([listDepartments(restaurant.id), listEvents(restaurant.id)])
      .then(([nextDepartments, nextEvents]) => {
        if (!active) return;
        setDepartments(nextDepartments);
        setEvents(nextEvents);
      })
      .catch(() => {
        // Orders still display; their groups fall back to generic headings.
      });
    return () => {
      active = false;
    };
  }, [restaurant.id]);

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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_opens',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const orderId = (payload.new as { order_id?: string }).order_id;
          if (!orderId) return;
          setOpenedIds((current) => {
            if (current.has(orderId)) return current;
            const next = new Set(current);
            next.add(orderId);
            return next;
          });
        }
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
      void markOrdersOpened([order.id]).catch(() => {
        // Shared state will converge on the next load; keep the local highlight.
      });
    }
    onOpenOrder(order);
  }

  const unopenedCount = orders.filter((o) => !openedIds.has(o.id)).length;

  const selectedLocations = locationFilter === 'all' ? null : locationFilter;
  const locationFiltered = selectedLocations
    ? orders.filter((o) =>
        (o.eventId && selectedLocations.has(o.eventId)) ||
        (!o.eventId && o.departmentId && selectedLocations.has(o.departmentId))
      )
    : orders;

  const filtered = filter === 'all'
    ? locationFiltered
    : locationFiltered.filter((o) => o.status === filter);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const searched = trimmedQuery
    ? filtered.filter((o) => o.orderNumber.toLowerCase().includes(trimmedQuery))
    : filtered;

  const groups = groupOrdersByScope(searched, departments, events);

  function toggleDate(key: string) {
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleLocation(id: string) {
    setLocationFilter((current) => {
      if (current === 'all') {
        const first = new Set([id]);
        saveLocationFilter(restaurant.id, first);
        return first;
      }
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const result: 'all' | Set<string> = next.size === 0 ? 'all' : next;
      saveLocationFilter(restaurant.id, result);
      return result;
    });
  }

  function selectAllLocations() {
    saveLocationFilter(restaurant.id, 'all');
    setLocationFilter('all');
  }

  const counts = {
    new: orders.filter((o) => o.status === 'new').length,
    inProgress: orders.filter((o) => o.status === 'accepted').length,
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
      {alerts.length > 0 ? (
        <div className="space-y-2" role="status" aria-live="polite">
          {alerts.map((alert) => (
            <OrderAlertBanner
              key={alert.id}
              order={alert}
              scopeTitle={orderScopeTitle(alert, departments, events)}
              onOpen={handleOpenOrder}
              onDismiss={dismissAlert}
            />
          ))}
        </div>
      ) : null}

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

      {/* Location filters */}
      <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
        <LocationButton active={locationFilter === 'all'} onClick={selectAllLocations}>
          All
        </LocationButton>
        {departments.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Department</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {departments.map((department) => (
                <LocationButton
                  key={department.id}
                  active={locationFilter !== 'all' && locationFilter.has(department.id)}
                  onClick={() => toggleLocation(department.id)}
                >
                  {department.name}
                </LocationButton>
              ))}
            </div>
          </div>
        ) : null}
        {departments.length > 0 && events.length > 0 ? (
          <hr className="my-4 border-cream-200" />
        ) : null}
        {events.length > 0 ? (
          <div className={departments.length > 0 ? '' : 'mt-4'}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Event</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {events.map((event) => (
                <LocationButton
                  key={event.id}
                  active={locationFilter !== 'all' && locationFilter.has(event.id)}
                  onClick={() => toggleLocation(event.id)}
                >
                  {event.name}
                </LocationButton>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Order search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by order number"
          className="w-full rounded-2xl bg-white py-3 pl-11 pr-11 text-sm text-ink placeholder:text-ink-faint shadow-soft ring-1 ring-cream-200 transition-all duration-200 focus:outline-none focus:ring-olive-300"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-faint transition-colors duration-200 hover:bg-cream-100 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Order list */}
      {groups.length === 0 ? (
        trimmedQuery ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 shadow-soft ring-1 ring-cream-200">
            <Search className="h-10 w-10 text-cream-300" />
            <p className="mt-3 text-sm text-ink-muted">No orders found</p>
            <p className="mt-1 text-xs text-ink-faint">
              No orders match “{searchQuery.trim()}” with the selected filters.
            </p>
          </div>
        ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 shadow-soft ring-1 ring-cream-200">
          <ShoppingBag className="h-10 w-10 text-cream-300" />
          <p className="mt-3 text-sm text-ink-muted">No orders here yet.</p>
          <p className="mt-1 text-xs text-ink-faint">
            Incoming test orders from visitors will appear here automatically.
          </p>
        </div>
        )
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const dateGroups = groupOrdersByDate(group.orders);
            return (
            <section key={group.key} aria-label={group.title}>
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <h3 className="font-display text-base font-semibold text-ink">{group.title}</h3>
                <span className="text-xs font-medium text-ink-muted">
                  {group.orders.length} {group.orders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
              <div className="space-y-3">
                {dateGroups.map((dateGroup) => {
                  const dateKey = `${group.key}:${dateGroup.dateKey}`;
                  const isExpanded = expandedDates.has(dateKey);
                  const hasUnopened = dateGroup.orders.some((order) => !openedIds.has(order.id));
                  return (
                    <div key={dateKey} className={cn(
                      'overflow-hidden rounded-2xl shadow-soft ring-1',
                      hasUnopened ? 'bg-orange-200 ring-orange-300' : 'bg-white ring-cream-200'
                    )}>
                      <button
                        type="button"
                        onClick={() => toggleDate(dateKey)}
                        aria-expanded={isExpanded}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 p-4 text-left transition-colors duration-200',
                          hasUnopened ? 'hover:bg-orange-100' : 'hover:bg-cream-100'
                        )}
                      >
                        <span className="font-display text-sm font-semibold text-ink">{dateGroup.label}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-medium text-ink-muted">
                            {dateGroup.orders.length} {dateGroup.orders.length === 1 ? 'order' : 'orders'}
                          </span>
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-ink-faint" />
                            : <ChevronRight className="h-4 w-4 text-ink-faint" />}
                        </span>
                      </button>
                      {isExpanded ? (
                        <ul className="space-y-3 border-t border-cream-100 p-3">
                          {dateGroup.orders.map((order) => {
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
                                      : 'bg-orange-200 ring-orange-300 hover:ring-orange-400'
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
                                    {order.serviceType && order.serviceLocation ? (
                                      <p className="mt-0.5 text-xs font-bold text-olive-800">
                                        {order.serviceType === 'room' ? 'ROOM' : 'TABLE'} {order.serviceLocation}
                                      </p>
                                    ) : null}
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
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
            );
          })}
        </div>
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
  );}

function groupOrdersByDate(orders: Order[]): { dateKey: string; label: string; orders: Order[] }[] {
  const groups = new Map<string, Order[]>();
  for (const order of orders) {
    const d = new Date(order.createdAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const list = groups.get(dateKey);
    if (list) {
      list.push(order);
    } else {
      groups.set(dateKey, [order]);
    }
  }
  return [...groups.entries()].map(([dateKey, list]) => ({
    dateKey,
    label: new Date(list[0].createdAt).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    orders: list,
  }));
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

function LocationButton({
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
          ? 'bg-orange-600 text-white shadow-soft'
          : 'bg-white text-ink ring-1 ring-cream-300 hover:ring-orange-300'
      )}
    >
      {children}
    </button>
  );
}

export { nextStatus, updateOrderStatus, statusLabel, STATUS_FLOW, STATUS_COLORS };
