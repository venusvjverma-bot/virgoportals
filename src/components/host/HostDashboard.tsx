import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { HostShell } from '@/components/host/HostShell';
import { RestaurantView } from '@/components/host/RestaurantView';
import { LlmUsageView } from '@/components/host/LlmUsageView';
import { CreditWalletView } from '@/components/host/CreditWalletView';
import { DepartmentsView } from '@/components/host/DepartmentsView';
import { EventsView } from '@/components/host/EventsView';
import { ResourceDetail } from '@/components/host/ResourceDetail';
import { OrdersView } from '@/components/host/OrdersView';
import { OrderDetailView } from '@/components/host/OrderDetailView';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { getOwnPortal, updatePortal } from '@/lib/portal';
import { listDepartments } from '@/lib/departments';
import { listEvents } from '@/lib/events';
import { useOrderAlertAudio } from '@/lib/orderAlertSound';
import type { Department, EventItem, HostView, Order, RestaurantPortal } from '@/types';

interface HostDashboardProps {
  onLogout: () => void;
}

export function HostDashboard({ onLogout }: HostDashboardProps) {
  const [portal, setPortal] = useState<RestaurantPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<HostView>('dashboard');
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const alertAudioRef = useOrderAlertAudio();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const found = await getOwnPortal();
        if (!active) return;
        if (!found) {
          setError('This account is not linked to a restaurant yet. Ask the Virgo team to set it up.');
          return;
        }
        setPortal(found);
        const [depts, evts] = await Promise.all([
          listDepartments(found.id),
          listEvents(found.id),
        ]);
        if (!active) return;
        setDepartments(depts);
        setEvents(evts);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load your portal.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveRestaurant(patch: Pick<RestaurantPortal, 'name' | 'city' | 'welcome' | 'timezone' | 'currency'>) {
    if (!portal) return;
    await updatePortal(portal.id, patch);
    setPortal({ ...portal, ...patch });
  }

  async function reloadResources(): Promise<{ departments: Department[]; events: EventItem[] }> {
    if (!portal) return { departments: [], events: [] };
    const [depts, evts] = await Promise.all([
      listDepartments(portal.id),
      listEvents(portal.id),
    ]);
    setDepartments(depts);
    setEvents(evts);
    return { departments: depts, events: evts };
  }

  function openDepartment(dept: Department) {
    setSelectedDepartment(dept);
    setView('department-detail');
  }

  function openEvent(ev: EventItem) {
    setSelectedEvent(ev);
    setView('event-detail');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
          Loading your portal…
        </div>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100 px-5">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-7 shadow-soft ring-1 ring-cream-200">
          <h1 className="font-display text-xl font-semibold text-ink">We could not open your portal</h1>
          <Notice tone="error">{error ?? 'Your restaurant was not found.'}</Notice>
          <Button variant="secondary" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <HostShell
      active={view}
      onSelect={(v) => {
        setView(v);
        setSelectedDepartment(null);
        setSelectedEvent(null);
        setSelectedOrder(null);
        setSelectedOrderId(null);
      }}
      restaurantName={portal.name || 'Your restaurant'}
      onLogout={onLogout}
    >
      {view === 'dashboard' ? (
        <>
          <RestaurantView portal={portal} onSave={saveRestaurant} />
          <CreditWalletView portal={portal} />
          <LlmUsageView portal={portal} />
        </>
      ) : null}

      {view === 'departments' ? (
        <DepartmentsView
          restaurant={portal}
          onOpenDepartment={openDepartment}
          onReload={async () => { await reloadResources(); }}
        />
      ) : null}

      {view === 'events' ? (
        <EventsView
          restaurant={portal}
          onOpenEvent={openEvent}
          onReload={async () => { await reloadResources(); }}
        />
      ) : null}

      {view === 'orders' ? (
        <OrdersView
          restaurant={portal}
          alertAudioRef={alertAudioRef}
          onOpenOrder={(order) => {
            setSelectedOrder(order);
            setSelectedOrderId(order.id);
            setView('order-detail');
          }}
        />
      ) : null}

      {view === 'order-detail' && selectedOrderId ? (
        <OrderDetailView
          orderId={selectedOrderId}
          onBack={() => {
            setSelectedOrder(null);
            setSelectedOrderId(null);
            setView('orders');
          }}
        />
      ) : null}

      {view === 'department-detail' && selectedDepartment ? (
        <ResourceDetail
          restaurant={portal}
          resource={selectedDepartment}
          resourceType="department"
          onBack={async () => {
            await reloadResources();
            setView('departments');
          }}
          onResourceChanged={async () => {
            const { departments: fresh } = await reloadResources();
            const updated = fresh.find((d) => d.id === selectedDepartment.id);
            if (updated) setSelectedDepartment(updated);
          }}
        />
      ) : null}

      {view === 'event-detail' && selectedEvent ? (
        <ResourceDetail
          restaurant={portal}
          resource={selectedEvent}
          resourceType="event"
          onBack={async () => {
            await reloadResources();
            setView('events');
          }}
          onResourceChanged={async () => {
            const { events: fresh } = await reloadResources();
            const updated = fresh.find((e) => e.id === selectedEvent.id);
            if (updated) setSelectedEvent(updated);
          }}
        />
      ) : null}
    </HostShell>
  );
}
