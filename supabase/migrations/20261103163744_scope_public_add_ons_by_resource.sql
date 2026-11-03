/*
# Scope public Add-on list by department or event

1. Changed function
- `get_public_add_ons` now accepts an optional resource type ('restaurant', 'department', 'event') and resource id.
- A department visitor receives only Add-ons whose department matches that department.
- An event visitor receives only Add-ons whose event matches that event.
- A restaurant-level visitor receives only Add-ons that are not attached to any department or event.

2. Compatibility
- The previous one-argument version is dropped so that PostgREST resolves calls to a single function.
- Existing callers that pass only the restaurant id keep working and receive restaurant-level Add-ons.

3. Security
- Function remains read-only and SECURITY DEFINER with a fixed search_path, as before.
- No table, column, or policy changes. No data is modified.

4. Notes
- Pricing, ordering, and availability rules are unchanged.
*/

DROP FUNCTION IF EXISTS public.get_public_add_ons(uuid);

CREATE OR REPLACE FUNCTION public.get_public_add_ons(
  p_restaurant_id uuid,
  p_resource_type text DEFAULT 'restaurant',
  p_resource_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, price text, image_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT d.id, d.name, d.price, d.image_url
FROM public.dishes d
WHERE d.restaurant_id = p_restaurant_id
  AND d.section = 'add_on'
  AND d.available = true
  AND (
    (p_resource_type = 'department' AND p_resource_id IS NOT NULL AND d.department_id = p_resource_id)
    OR (p_resource_type = 'event' AND p_resource_id IS NOT NULL AND d.event_id = p_resource_id)
    OR (COALESCE(p_resource_type, 'restaurant') NOT IN ('department', 'event') AND d.department_id IS NULL AND d.event_id IS NULL)
  )
ORDER BY d.sort_order ASC;
$function$;
