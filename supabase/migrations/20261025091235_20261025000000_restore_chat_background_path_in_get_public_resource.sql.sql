/*
# Restore chat_background_path in get_public_resource

1. Background
- The `get_public_resource(uuid, text)` function was recreated by an earlier
  migration ("public_functions_return_currency") to add a `currency` column.
- That recreation accidentally dropped the `chat_background_path` return column
  and the LEFT JOIN to `theme_assets` that populated it for departments/events.
- As a result, the visitor chat page never received the host-selected background
  image for a department or event, so the background never rendered.
- Currency loading was unaffected and must continue to work.

2. Changes
- Drop and recreate `public.get_public_resource(uuid, text)` so its return
  signature includes BOTH `chat_background_path text` and `currency text`.
- Department branch: restore `LEFT JOIN theme_assets ta ON ta.id = d.chat_background_asset_id AND ta.shared = true`, selecting `ta.storage_path` as `chat_background_path`.
- Event branch: same join against `events.chat_background_asset_id`.
- Restaurant branch: select `NULL::text` for `chat_background_path` (no restaurant-level background), preserving `currency`.
- All existing return columns and behavior are preserved.

3. Security
- No table, RLS, or policy changes.
- The function remains SECURITY DEFINER with `search_path = public`.
- EXECUTE is revoked from PUBLIC/anon and granted only to `anon, authenticated` (the public visitor RPC callers), matching the prior state.

4. Data
- No data is modified or deleted. Host background selections on
  departments/events are untouched.
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
      ta.storage_path,
      r.currency
    FROM departments d
    JOIN restaurants r ON r.id = d.restaurant_id
    LEFT JOIN theme_assets ta ON ta.id = d.chat_background_asset_id AND ta.shared = true
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
      ta.storage_path,
      r.currency
    FROM events e
    JOIN restaurants r ON r.id = e.restaurant_id
    LEFT JOIN theme_assets ta ON ta.id = e.chat_background_asset_id AND ta.shared = true
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
      NULL::text,
      r.currency
    FROM restaurants r
    WHERE r.id = p_resource_id AND r.status = 'Active';
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_resource(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_resource(uuid, text) TO anon, authenticated;
