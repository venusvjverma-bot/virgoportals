/*
# Add automatic schedule-based checkout availability to departments

1. New Columns
- `departments.schedule_available` boolean NOT NULL DEFAULT false
  When false (default), checkout availability depends only on the existing
  manual is_active status, exactly as before. When true AND is_active is true,
  checkout is only available within the department's own saved
  open_time/close_time window, evaluated in the restaurant's saved timezone.
  This column never changes is_active; the manual status always takes priority.

2. Modified Functions
- `get_public_resource` now also returns the department's is_active and
  schedule_available flags for departments (events/restaurants return
  true/false so the shape stays uniform). Returning the extra columns requires
  the RETURNS TABLE row type to change, so the function is dropped and
  recreated in this migration; the signature (uuid, text) is unchanged and the
  existing EXECUTE grant to anon, authenticated is re-granted below.

3. Security
- No RLS changes. The function is SECURITY DEFINER with the same EXECUTE grant
  as before. The two new returned columns are non-sensitive availability flags.
*/

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS schedule_available boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_public_resource(uuid, text);

CREATE FUNCTION public.get_public_resource(
  p_resource_id uuid,
  p_resource_type text
) RETURNS TABLE(
  resource_id uuid,
  resource_name text,
  resource_type text,
  open_time text,
  close_time text,
  start_date date,
  end_date date,
  start_time text,
  end_time text,
  restaurant_id uuid,
  restaurant_name text,
  city text,
  welcome text,
  system_prompt text,
  timezone text,
  is_active boolean,
  schedule_available boolean
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_resource_type = 'department' THEN
    RETURN QUERY
    SELECT
      d.id, d.name, 'department',
      d.open_time, d.close_time,
      NULL::date, NULL::date, NULL::text, NULL::text,
      r.id, r.name, r.city, r.welcome,
      COALESCE(NULLIF(d.system_prompt, ''), r.system_prompt),
      r.timezone,
      d.is_active,
      d.schedule_available
    FROM departments d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = p_resource_id AND r.status = 'Active';

  ELSIF p_resource_type = 'event' THEN
    RETURN QUERY
    SELECT
      e.id, e.name, 'event',
      NULL::text, NULL::text,
      e.start_date, e.end_date, e.start_time, e.end_time,
      r.id, r.name, r.city, r.welcome,
      COALESCE(NULLIF(e.system_prompt, ''), r.system_prompt),
      r.timezone,
      true,
      false
    FROM events e
    JOIN restaurants r ON r.id = e.restaurant_id
    WHERE e.id = p_resource_id AND r.status = 'Active';

  ELSIF p_resource_type = 'restaurant' THEN
    RETURN QUERY
    SELECT
      r.id, r.name, 'restaurant',
      NULL::text, NULL::text,
      NULL::date, NULL::date, NULL::text, NULL::text,
      r.id, r.name, r.city, r.welcome,
      r.system_prompt,
      r.timezone,
      true,
      false
    FROM restaurants r
    WHERE r.id = p_resource_id AND r.status = 'Active';
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_resource(uuid, text) TO anon, authenticated;
