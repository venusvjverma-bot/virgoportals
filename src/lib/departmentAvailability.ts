/**
 * Automatic schedule-based checkout availability for departments.
 *
 * This is an availability layer ON TOP of the manual is_active status. It
 * never modifies is_active: manual status is always the source of truth and
 * takes priority over any schedule calculation.
 *
 * All wall-clock math runs in the restaurant's saved IANA timezone — never the
 * visitor's device timezone or the server's default timezone. Times are
 * converted to comparable UTC instants using the same pattern as
 * eventStatus.tsx (render local wall time in the zone, read the parts back as
 * UTC). Blank opening/closing fields keep their existing "Always open"
 * meaning.
 */

export type DepartmentAvailability = 'available' | 'schedule-closed' | 'manual-inactive';

interface ScheduleShape {
  openTime: string | null;
  closeTime: string | null;
}

function parseHhMm(value: string | null | undefined): { h: number; m: number } | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/**
 * Converts a wall time on a specific restaurant-local calendar day into a UTC
 * instant. Wall time "HH:mm" is combined with the date parts (which are the
 * restaurant-local day) and the zone offset is resolved by re-reading the
 * rendered parts.
 */
function localWallTimeToInstant(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number | null {
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(key));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  const y = get('year');
  const mo = get('month');
  const d = get('day');
  const h = get('hour') % 24;
  const mi = get('minute');
  const s = get('second');
  if ([y, mo, d, h, mi, s].some((n) => Number.isNaN(n))) return null;
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

/**
 * Current restaurant-local calendar date parts, resolved in the zone.
 */
function nowPartsInZone(timeZone: string, at: number): { year: number; month: number; day: number; minuteOfDay: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date(at));
    const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? NaN);
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour') % 24;
    const minute = get('minute');
    if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
    return { year, month, day, minuteOfDay: hour * 60 + minute };
  } catch {
    return null;
  }
}

/**
 * Whether the department's saved opening window contains the given moment.
 * Returns true when the schedule is blank (Always open) or unparseable so a
 * bad saved value cannot silently close an open department.
 * Overnight windows (e.g. 18:00–02:00) are supported: when closing is earlier
 * than opening the window spans midnight.
 */
export function isWithinOpeningHours(
  schedule: ScheduleShape,
  timeZone: string,
  at: number = Date.now()
): boolean {
  const open = parseHhMm(schedule.openTime);
  const close = parseHhMm(schedule.closeTime);
  if (!open && !close) return true;

  const now = nowPartsInZone(timeZone, at);
  if (!now) return true;

  // If both bounds exist, compare full instants (handles midnight crossing).
  if (open && close) {
    const dayStart = localWallTimeToInstant(timeZone, now.year, now.month, now.day, 0, 0);
    if (dayStart === null) return true;
    const openAt = dayStart + (open.h * 60 + open.m) * 60_000;
    const closeAt = dayStart + (close.h * 60 + close.m) * 60_000;
    const atMs = dayStart + now.minuteOfDay * 60_000;
    if (openAt === closeAt) return true;
    if (openAt < closeAt) {
      return atMs >= openAt && atMs < closeAt;
    }
    // Overnight window: open e.g. 18:00, close e.g. 02:00 next day.
    return atMs >= openAt || atMs < closeAt;
  }

  // Only one bound saved: treat the day as split at that bound.
  const openMinutes = open ? open.h * 60 + open.m : null;
  const closeMinutes = close ? close.h * 60 + close.m : null;
  if (openMinutes !== null) return now.minuteOfDay >= openMinutes;
  return now.minuteOfDay < closeMinutes!;
}

/**
 * The department's saved opening time for display in the schedule-closed
 * message. Schedules repeat daily (no day-specific schedules), so the next
 * opening is always the saved opening wall time; the label uses the actual
 * configured value, never a hardcoded one. Returns null when no opening time
 * is saved (Always open — no meaningful "next opening").
 */
export function nextOpeningLabel(schedule: ScheduleShape): string | null {
  const open = parseHhMm(schedule.openTime);
  if (!open) return null;
  return `${String(open.h).padStart(2, '0')}:${String(open.m).padStart(2, '0')}`;
}

/**
 * Full availability decision under the priority rule:
 *   manual Inactive -> always unavailable (existing manual behavior)
 *   manual Active + schedule disabled -> always available
 *   manual Active + schedule enabled -> within opening hours decides
 */
export function departmentAvailability(
  isActive: boolean,
  scheduleAvailable: boolean,
  schedule: ScheduleShape,
  timeZone: string,
  at: number = Date.now()
): DepartmentAvailability {
  if (!isActive) return 'manual-inactive';
  if (!scheduleAvailable) return 'available';
  return isWithinOpeningHours(schedule, timeZone, at) ? 'available' : 'schedule-closed';
}
