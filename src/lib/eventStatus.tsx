import type { EventItem } from '@/types';

export type DynamicStatus = 'upcoming' | 'active' | 'expired';

/**
 * Builds the scheduled start and end instants for an event using the
 * restaurant's configured timezone. Date strings are "YYYY-MM-DD" and
 * time strings are "HH:mm" — both interpreted in the restaurant's tz,
 * never as UTC. When no times are provided the event runs all day:
 * start = 00:00 on startDate, end = 23:59:59 on endDate.
 *
 * Returns null when the schedule is missing or invalid.
 */
export function scheduleInstants(
  ev: Pick<EventItem, 'startDate' | 'endDate' | 'startTime' | 'endTime'>,
  timezone: string
): { start: number; end: number } | null {
  if (!ev.startDate || !ev.endDate) return null;

  try {
    const startParts = ev.startTime ? ev.startTime.split(':') : ['0', '0'];
    const endParts = ev.endTime ? ev.endTime.split(':') : ['23', '59'];

    const startStr = `${ev.startDate}T${String(startParts[0]).padStart(2, '0')}:${String(startParts[1]).padStart(2, '0')}:00`;
    const endStr = `${ev.endDate}T${String(endParts[0]).padStart(2, '0')}:${String(endParts[1]).padStart(2, '0')}:59`;

    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const startInTz = fmt.formatToParts(new Date(startStr));
    const endInTz = fmt.formatToParts(new Date(endStr));

    const startUtc = new Date(
      `${startInTz.find((p) => p.type === 'year')?.value}-${startInTz.find((p) => p.type === 'month')?.value}-${startInTz.find((p) => p.type === 'day')?.value}T${startInTz.find((p) => p.type === 'hour')?.value}:${startInTz.find((p) => p.type === 'minute')?.value}:${startInTz.find((p) => p.type === 'second')?.value}Z`
    ).getTime();
    const endUtc = new Date(
      `${endInTz.find((p) => p.type === 'year')?.value}-${endInTz.find((p) => p.type === 'month')?.value}-${endInTz.find((p) => p.type === 'day')?.value}T${endInTz.find((p) => p.type === 'hour')?.value}:${endInTz.find((p) => p.type === 'minute')?.value}:${endInTz.find((p) => p.type === 'second')?.value}Z`
    ).getTime();

    if (!Number.isFinite(startUtc) || !Number.isFinite(endUtc) || endUtc < startUtc) {
      return null;
    }

    return { start: startUtc, end: endUtc };
  } catch {
    return null;
  }
}

export function computeEventStatus(
  ev: Pick<EventItem, 'startDate' | 'endDate' | 'startTime' | 'endTime'>,
  timezone: string,
  now: number = Date.now()
): DynamicStatus {
  const instants = scheduleInstants(ev, timezone);
  if (!instants) return 'upcoming';

  if (now < instants.start) return 'upcoming';
  if (now >= instants.end) return 'expired';
  return 'active';
}

/**
 * Returns the timestamp of the next status transition for the given event,
 * or null if the event is already expired (no further transitions).
 */
export function nextEventTransition(
  ev: Pick<EventItem, 'startDate' | 'endDate' | 'startTime' | 'endTime'>,
  timezone: string,
  now: number = Date.now()
): number | null {
  const instants = scheduleInstants(ev, timezone);
  if (!instants) return null;

  if (now < instants.start) return instants.start;
  if (now < instants.end) return instants.end;
  return null;
}

export const EVENT_BADGE_STYLES: Record<DynamicStatus, { bg: string; color: string; label: string }> = {
  upcoming: { bg: '#E4E8DF', color: '#465641', label: 'Upcoming' },
  active: { bg: '#DDEBDD', color: '#315B37', label: 'Active' },
  expired: { bg: '#FBE5E4', color: '#B42318', label: 'Expired' },
};

export function EventStatusBadge({ status }: { status: DynamicStatus }) {
  const s = EVENT_BADGE_STYLES[status];
  return (
    <span
      className="inline-flex items-center rounded-full text-[13px] font-medium"
      style={{
        backgroundColor: s.bg,
        color: s.color,
        padding: '6px 12px',
      }}
    >
      {s.label}
    </span>
  );
}
