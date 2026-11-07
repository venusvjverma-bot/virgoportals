/*
# Secure department session closure

1. Functions
- `close_department_session(uuid)` closes one running session for the signed-in Host or an administrator.
- The function refuses missing, already closed, or unauthorized sessions and returns the closed session.

2. Security
- Hosts retain SELECT access to their own restaurant sessions.
- Direct UPDATE access is removed from authenticated users so session identity and timestamps cannot be edited from the browser.
- The close function is security-definer, has a pinned search path, and is executable only by authenticated users.
*/

REVOKE UPDATE ON public.department_sessions FROM authenticated;

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
BEGIN
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

REVOKE EXECUTE ON FUNCTION public.close_department_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_department_session(uuid) TO authenticated;
