/*
# Serving Area at checkout: order fields + public service settings

1. Overview
   Connects the Host's Type of Service configuration (Table/Room Service)
   to the visitor checkout. Two changes:
   a) Orders store the selected service, the guest's table/room reference
      and the service charge.
   b) The existing public `get_public_resource` function (used by QR
      visitors) also returns the service settings for the exact department
      or event in the QR code, so no host configuration tables are exposed
      through new anon policies.

2. Modified Tables
   - `orders`: new columns
     - `service_type` (text, nullable, 'table' or 'room', CHECK constrained)
     - `service_location` (text, nullable, guest's alphanumeric reference)
     - `service_charge_minor` (integer, NOT NULL, default 0, minor units,
       CHECK >= 0)
   - Existing orders keep NULL service fields and zero charge, so history,
     reports and screens continue to work unchanged.

3. Modified Functions
   - `get_public_resource`: return signature extended with
     `table_service_enabled`, `table_service_charge`,
     `room_service_enabled`, `room_service_charge` (from the department or
     event row; false/0 for restaurant-level resources). SECURITY DEFINER
     with pinned search_path, unchanged; still only returns rows for active
     restaurants and non-archived resources. Postgres cannot alter a
     function's return type in place, so the old signature is dropped first;
     the two dependencies reported by pg_depend are internal (extension and
     schema), so the drop is safe.

4. Security
   - No new tables, policies or grants. `orders` columns are covered by the
     existing RLS policies and grants. Service settings reach visitors only
     through the existing `get_public_resource` RPC, a narrow public
     projection. Charge amounts are never accepted from the browser; the
     edge function reads them from the database.
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS service_type text NULL
    CHECK (service_type IN ('table', 'room')),
  ADD COLUMN IF NOT EXISTS service_location text NULL,
  ADD COLUMN IF NOT EXISTS service_charge_minor integer NOT NULL DEFAULT 0
    CHECK (service_charge_minor >= 0);

DROP FUNCTION IF EXISTS public.get_public_resource(uuid, text);

CREATE OR REPLACE FUNCTION public.get_public_resource(p_resource_id uuid, p_resource_type text)
RETURNS TABLE(
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
  room_service_charge integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
d.room_service_charge
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
e.room_service_charge
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
0
FROM restaurants r
WHERE r.id = p_resource_id AND r.status = 'Active';
END IF;

RETURN;
END;
$function$;
