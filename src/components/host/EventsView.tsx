import { useEffect, useMemo, useState } from 'react';
import { Calendar, CalendarDays, ChevronRight, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { createEvent, listEvents } from '@/lib/events';
import { computeEventStatus, nextEventTransition, EventStatusBadge, type DynamicStatus } from '@/lib/eventStatus';
import type { EventItem, RestaurantPortal } from '@/types';

interface EventsViewProps {
  restaurant: RestaurantPortal;
  onOpenEvent: (event: EventItem) => void;
  onReload: () => Promise<void>;
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return start;
  return `${start} – ${end}`;
}

export function EventsView({ restaurant, onOpenEvent, onReload }: EventsViewProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState(todayISO());
  const [newEndDate, setNewEndDate] = useState(todayISO());
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Tick state — bumped by a timer at the next relevant transition so
  // badges update live without re-fetching from the database.
  const [now, setNow] = useState(() => Date.now());

  const timezone = restaurant.timezone || 'UTC';

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await listEvents(restaurant.id);
        if (active) setEvents(rows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load events.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [restaurant.id]);

  // Set a single timer for the nearest upcoming transition across all events.
  // When it fires, the tick advances and the effect re-runs to schedule the
  // next one. No polling, no continuous re-fetch.
  useEffect(() => {
    if (events.length === 0) return;

    const currentNow = Date.now();
    let earliest: number | null = null;
    for (const ev of events) {
      const t = nextEventTransition(ev, timezone, currentNow);
      if (t !== null && (earliest === null || t < earliest)) {
        earliest = t;
      }
    }

    if (earliest === null) return;

    const delay = earliest - currentNow;
    if (delay <= 0) {
      setNow(Date.now());
      return;
    }

    const timer = setTimeout(() => setNow(Date.now()), delay + 100);
    return () => clearTimeout(timer);
  }, [events, timezone, now]);

  const withStatus = useMemo(
    () => events.map((ev) => ({ ev, status: computeEventStatus(ev, timezone, now) })),
    [events, timezone, now]
  );

  const upcoming = withStatus.filter((e) => e.status === 'upcoming' || e.status === 'active');
  const past = withStatus.filter((e) => e.status === 'expired');

  async function handleCreate() {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError('Enter an event name.');
      return;
    }
    if (newEndDate < newStartDate) {
      setCreateError('End date cannot be before start date.');
      return;
    }
    setCreating(true);
    try {
      const ev = await createEvent(restaurant.id, {
        name: newName.trim(),
        startDate: newStartDate,
        endDate: newEndDate,
        startTime: newStartTime || null,
        endTime: newEndTime || null,
      });
      setEvents((prev) => [ev, ...prev]);
      setNewName('');
      setNewStartDate(todayISO());
      setNewEndDate(todayISO());
      setNewStartTime('');
      setNewEndTime('');
      setAdding(false);
      await onReload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create event.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-14 text-sm text-ink-muted">
        Loading events…
      </Card>
    );
  }

  if (error) {
    return <Notice tone="error">{error}</Notice>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1
          className="text-[38px] font-bold leading-tight sm:text-[52px]"
          style={{ fontFamily: 'Georgia, serif', color: '#292A27' }}
        >
          Events
        </h1>
        <p className="text-[15px] leading-[1.5]" style={{ color: '#77766F' }}>
          Create temporary services with their own menu, AI assistant and QR code.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </p>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-4 w-4" />
          Create event
        </Button>
      </div>

      {adding ? (
        <Card className="animate-fade-in">
          <h3 className="font-display text-lg font-semibold text-ink">New event</h3>
          <p className="mt-1 text-sm text-ink-muted">e.g. Wedding, Conference, Christmas Buffet, Private Dinner</p>
          <div className="mt-4 space-y-4">
            <div>
              <Input
                value={newName}
                placeholder="Event name"
                onChange={(e) => { setNewName(e.target.value); setCreateError(null); }}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Start date</label>
                <Input type="date" value={newStartDate} onChange={(e) => { setNewStartDate(e.target.value); setCreateError(null); }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">End date</label>
                <Input type="date" value={newEndDate} onChange={(e) => { setNewEndDate(e.target.value); setCreateError(null); }} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Start time (optional)</label>
                <Select value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)}>
                  <option value="">All day</option>
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">End time (optional)</label>
                <Select value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)}>
                  <option value="">All day</option>
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
            </div>
          </div>
          {createError ? <Notice tone="error" className="mt-4">{createError}</Notice> : null}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create event'}
            </Button>
            <Button variant="secondary" onClick={() => { setAdding(false); setNewName(''); setCreateError(null); }}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {upcoming.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-muted">Upcoming & Active</h3>
          <div className="space-y-4">
            {upcoming.map(({ ev, status }) => (
              <EventCard key={ev.id} event={ev} status={status} onOpen={() => onOpenEvent(ev)} />
            ))}
          </div>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-muted">Past</h3>
          <div className="space-y-4">
            {past.map(({ ev, status }) => (
              <EventCard key={ev.id} event={ev} status={status} onOpen={() => onOpenEvent(ev)} />
            ))}
          </div>
        </div>
      ) : null}

      {events.length === 0 && !adding ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-100 text-olive-600">
            <Calendar className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-ink">No events yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Click "Create event" to set up a temporary service with its own menu, bot and QR.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function EventCard({
  event,
  status,
  onOpen,
}: {
  event: EventItem;
  status: DynamicStatus;
  onOpen: () => void;
}) {
  const dateRange = formatDateRange(event.startDate, event.endDate);
  const timeRange = event.startTime
    ? event.endTime
      ? `${event.startTime} – ${event.endTime}`
      : event.startTime
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full rounded-[22px] p-5 text-left transition-all duration-[175ms] ease-out hover:shadow-[0_8px_24px_rgba(41,42,39,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500 focus-visible:ring-offset-2 active:bg-[#FBFAF7] motion-reduce:transition-none sm:p-6"
      style={{
        backgroundColor: '#FFFEFC',
        border: '1px solid #E8E1D7',
        boxShadow: '0 4px 14px rgba(41, 42, 39, 0.06)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#E4E8DF' }}
        >
          <CalendarDays className="h-[22px] w-[22px]" style={{ color: '#58664F' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="text-[21px] font-bold leading-tight sm:text-[24px]"
              style={{ fontFamily: 'Georgia, serif', color: '#292A27' }}
            >
              {event.name}
            </h3>
            <EventStatusBadge status={status} />
          </div>

          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex items-center gap-1.5 text-[15px]" style={{ color: '#77766F' }}>
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{dateRange}</span>
            </span>
            {timeRange ? (
              <span className="flex items-center gap-1.5 text-[15px]" style={{ color: '#77766F' }}>
                <Clock className="h-4 w-4 shrink-0" />
                <span>{timeRange}</span>
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 text-[13px]" style={{ color: '#9A978E' }}>
            Event menu, schedule and QR settings
          </p>
        </div>
        <ChevronRight
          className="mt-1 h-5 w-5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
          style={{ color: '#58664F' }}
        />
      </div>
    </button>
  );
}
