/*
# Update public portal functions to return restaurant currency

1. Changes
- `get_public_portal` now returns an additional `currency` column.
- `get_public_resource` now returns an additional `currency` column.
- Both functions are dropped and recreated because the return type changed.
- The visitor page needs the restaurant's currency to format prices in basket
  and checkout before an order is created.

2. Security
- No policy changes — both functions grant EXECUTE to anon/authenticated.
- `currency` is a public field (price display formatting), not sensitive data.
*/

DROP FUNCTION IF EXISTS public.get_public_portal(uuid);
DROP FUNCTION IF EXISTS public.get_public_resource(uuid, text);

CREATE FUNCTION public.get_public_portal(p_portal_id uuid)
RETURNS TABLE (id uuid, name text, city text, welcome text, currency text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.city, r.welcome, r.currency
  FROM public.restaurants r
  WHERE r.id = p_portal_id
    AND r.status = 'Active';
$$;

REVOKE ALL ON FUNCTION public.get_public_portal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_portal(uuid) TO anon, authenticated;

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
  currency text
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
      r.currency
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
      r.currency
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
      r.currency
    FROM restaurants r
    WHERE r.id = p_resource_id AND r.status = 'Active';
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_resource(uuid, text) TO anon, authenticated;
