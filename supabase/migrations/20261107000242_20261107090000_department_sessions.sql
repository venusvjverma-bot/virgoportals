/*
# Add department sessions and automatic accepted-order assignment

1. New Tables
- `department_sessions` stores one reportable session per Department, including its start time, optional close time, and closed state.

2. Modified Tables
- `orders.session_id` links an accepted Department order to the exact session that received it. The link is immutable after assignment.

3. Session behavior
- A session is created only when a Department order changes to `accepted`.
- Concurrent accepted orders for the same Department are serialized with a transaction advisory lock and a unique running-session index.
- Accepted orders without a Department are not assigned to a session.
- Sessions do not close automatically and can continue across midnight.

4. Security
- Row-level security is enabled on `department_sessions`.
- Hosts may read and close sessions belonging to their own restaurant; administrators may read and close all sessions.
- The assignment trigger runs as a tightly scoped security-definer function and is not callable through the Data API.
- Existing order history and status workflows are preserved.
*/

CREATE TABLE IF NOT EXISTS public.department_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_sessions_close_after_start CHECK (closed_at IS NULL OR closed_at >= started_at)
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS session_id uuid NULL REFERENCES public.department_sessions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS department_sessions_department_started_idx
  ON public.department_sessions (department_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS department_sessions_one_running_idx
  ON public.department_sessions (department_id)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_session_id_idx ON public.orders (session_id);

ALTER TABLE public.department_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.department_sessions TO authenticated;

DROP POLICY IF EXISTS "hosts_select_own_department_sessions" ON public.department_sessions;
CREATE POLICY "hosts_select_own_department_sessions"
ON public.department_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.id = department_sessions.department_id
      AND (public.owns_restaurant(d.restaurant_id) OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "hosts_update_own_department_sessions" ON public.department_sessions;
CREATE POLICY "hosts_update_own_department_sessions"
ON public.department_sessions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.id = department_sessions.department_id
      AND (public.owns_restaurant(d.restaurant_id) OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.id = department_sessions.department_id
      AND (public.owns_restaurant(d.restaurant_id) OR public.is_admin())
  )
  AND closed_at IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.assign_order_to_department_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'accepted'
     AND NEW.department_id IS NOT NULL
     AND NEW.session_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.department_id::text, 0));

    SELECT id INTO v_session_id
    FROM public.department_sessions
    WHERE department_id = NEW.department_id
      AND closed_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_session_id IS NULL THEN
      INSERT INTO public.department_sessions (department_id)
      VALUES (NEW.department_id)
      RETURNING id INTO v_session_id;
    END IF;

    NEW.session_id := v_session_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_assign_department_session ON public.orders;
CREATE TRIGGER orders_assign_department_session
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_to_department_session();

REVOKE ALL ON FUNCTION public.assign_order_to_department_session() FROM PUBLIC, anon, authenticated;
