/*
# Prevent closing sessions/events with accepted orders

1. Behaviour changes
- `close_department_session(uuid)` now refuses to close a session while any order
  attached to it (`orders.session_id`) still has status `accepted`. The error
  message states the number of outstanding accepted orders. Ownership, admin and
  open-session validation are unchanged.
- New `close_event(uuid)` sets an event's status to `ended` only when the signed-in
  Host owns the event's restaurant (or is an administrator) and no order linked to
  the event (`orders.event_id`) has status `accepted`. The error message states the
  number of outstanding accepted orders. Already-ended events are left unchanged.
- New trigger function `guard_event_status_change()` on `events` prevents ANY
  client (including direct table updates) from moving an event to `ended` while
  accepted orders exist, so the rule cannot be bypassed outside `close_event`.

2. Tables modified
- `events`: BEFORE UPDATE trigger `events_guard_ended_status`.

3. Security
- `close_event` is SECURITY DEFINER with pinned `search_path`, executable only by
  `authenticated` (EXECUTE revoked from PUBLIC and anon). The trigger applies to
  all roles because it runs inside the database itself.

4. Notes
- Only `accepted` orders block closure; `new`, `completed` and `cancelled` never do.
- No order statuses are changed by this migration.
*/

CREATE OR REPLACE FUNCTION public.close_department_session(p_session_id uuid)
RETURNS TABLE (
  id uuid,
  department_id uuid,
  started_at timestamptz,
  closed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outstanding integer;
BEGIN
  SELECT count(*) INTO v_outstanding
  FROM public.orders o
  WHERE o.session_id = p_session_id
    AND o.status = 'accepted';

  IF v_outstanding > 0 THEN
    RAISE EXCEPTION 'Cannot close this session: % accepted order(s) still require attention.', v_outstanding;
  END IF;

  RETURN QUERY
  UPDATE public.department_sessions s
  SET closed_at = now()
  FROM public.departments d
  WHERE s.id = p_session_id
    AND s.department_id = d.id
    AND s.closed_at IS NULL
    AND (public.owns_restaurant(d.restaurant_id) OR public.is_admin())
  RETURNING s.id, s.department_id, s.started_at, s.closed_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found, already closed, or not authorized';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_event(p_event_id uuid)
RETURNS TABLE (
  id uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_outstanding integer;
BEGIN
  SELECT e.restaurant_id INTO v_restaurant_id
  FROM public.events e
  WHERE e.id = p_event_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT (public.owns_restaurant(v_restaurant_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Event not found or not authorized';
  END IF;

  SELECT count(*) INTO v_outstanding
  FROM public.orders o
  WHERE o.event_id = p_event_id
    AND o.status = 'accepted';

  IF v_outstanding > 0 THEN
    RAISE EXCEPTION 'Cannot end this event: % accepted order(s) still require attention.', v_outstanding;
  END IF;

  RETURN QUERY
  UPDATE public.events e
  SET status = 'ended', updated_at = now()
  WHERE e.id = p_event_id
    AND e.status <> 'ended'
  RETURNING e.id, e.status::text;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_event_id, 'ended'::text;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_event(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_event_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outstanding integer;
BEGIN
  IF NEW.status = 'ended' AND OLD.status <> 'ended' THEN
    SELECT count(*) INTO v_outstanding
    FROM public.orders o
    WHERE o.event_id = NEW.id
      AND o.status = 'accepted';

    IF v_outstanding > 0 THEN
      RAISE EXCEPTION 'Cannot end this event: % accepted order(s) still require attention.', v_outstanding;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_guard_ended_status ON public.events;

CREATE TRIGGER events_guard_ended_status
BEFORE UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.guard_event_status_change();
