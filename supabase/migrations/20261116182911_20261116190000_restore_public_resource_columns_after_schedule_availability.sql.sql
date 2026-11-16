/*
# Restore chat_background_path and service columns in get_public_resource

1. Problem
   The previous migration (add_department_schedule_availability) recreated
   `get_public_resource` from a stale copy and accidentally omitted the
   `chat_background_path` column (added by the chat background sharing
   feature) plus `currency` and the table/room service columns added by the
   serving-area feature. Visitor pages therefore lost the selected chat
   background theme for departments and events, and the row shape that the
   frontend mapper expects no longer matched.

2. Modified Functions
   - `get_public_resource(uuid, text)`: full RETURNS TABLE restored —
     chat_background_path, currency, table_service_enabled,
     table_service_charge, room_service_enabled, room_service_charge —
     alongside the new schedule availability columns (is_active,
     schedule_available). Department and event branches re-add the
     `theme_assets` join for the shared background; the restaurant branch
     returns NULL for the background. Archived filters, SECURITY DEFINER and
     pinned search_path are preserved. Postgres cannot alter a return type in
     place, so the function is dropped and recreated; the (uuid, text)
     signature is unchanged and EXECUTE is re-granted to anon, authenticated.

3. Security
   - No RLS changes. Only the existing EXECUTE grant is re-applied.
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

  ELSIF p_resource_type = 'resource_type_restaurant' THEN
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