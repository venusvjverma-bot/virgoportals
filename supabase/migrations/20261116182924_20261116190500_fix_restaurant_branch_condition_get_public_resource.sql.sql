/*
# Fix restaurant branch condition in get_public_resource

1. Problem
   The previous migration typed the restaurant branch comparison as
   'resource_type_restaurant' instead of 'restaurant', so restaurant-level
   QR lookups returned no rows.

2. Modified Functions
   - `get_public_resource(uuid, text)`: branch condition corrected back to
     'restaurant'. Everything else unchanged.

3. Security
   - EXECUTE re-granted to anon, authenticated as before.
*/

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
  chat_background_path text,
  currency text,
  table_service_enabled boolean,
  table_service_charge integer,
  room_service_enabled boolean,
  room_service_charge integer,
  is_active boolean,
  schedule_available boolean
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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
      ta.storage_path,
      r.currency,
      d.table_service_enabled,
      d.table_service_charge,
      d.room_service_enabled,
      d.room_service_charge,
      d.is_active,
      d.schedule_available
    FROM departments d
    JOIN restaurants r ON r.id = d.restaurant_id
    LEFT JOIN theme_assets ta ON ta.id = d.chat_background_asset_id AND ta.shared = true
    WHERE d.id = p_resource_id AND d.archived = false AND r.status = 'Active';

  ELSIF p_resource_type = 'event' THEN
    RETURN QUERY
    SELECT
      e.id, e.name, 'event',
      NULL::text, NULL::text,
      e.start_date, e.end_date, e.start_time, e.end_time,
      r.id, r.name, r.city, r.welcome,
      COALESCE(NULLIF(e.system_prompt, ''), r.system_prompt),
      r.timezone,
      ta.storage_path,
      r.currency,
      e.table_service_enabled,
      e.table_service_charge,
      e.room_service_enabled,
      e.room_service_charge,
      true,
      false
    FROM events e
    JOIN restaurants r ON r.id = e.restaurant_id
    LEFT JOIN theme_assets ta ON ta.id = e.chat_background_asset_id AND ta.shared = true
    WHERE e.id = p_resource_id AND e.status <> 'archived' AND r.status = 'Active';

  ELSIF p_resource_type = 'restaurant' THEN
    RETURN QUERY
    SELECT
      r.id, r.name, 'restaurant',
      NULL::text, NULL::text,
      NULL::date, NULL::date, NULL::text, NULL::text,
      r.id, r.name, r.city, r.welcome,
      r.system_prompt,
      r.timezone,
      NULL::text,
      r.currency,
      false,
      0,
      false,
      0,
      true,
      false
    FROM restaurants r
    WHERE r.id = p_resource_id AND r.status = 'Active';
  END IF;

  RETURN;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_resource(uuid, text) TO anon, authenticated;