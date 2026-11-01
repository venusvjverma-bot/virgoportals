/*
# Public read of available Add-on items

1. New Function
- `get_public_add_ons(p_restaurant_id uuid)` returns the id, name, price and image of every
  available dish in the `add_on` section for one restaurant, ordered by the Host's sort order.

2. Security
- The `dishes` table stays closed to anonymous and signed-in readers outside the Host's own
  restaurant. This function is the only public path to Add-on rows.
- Runs as SECURITY DEFINER with a fixed search_path and returns only the four public columns.
- EXECUTE is revoked from PUBLIC and granted to `anon` and `authenticated` only.

3. Notes
- No table, column or existing policy is changed.
*/

CREATE OR REPLACE FUNCTION public.get_public_add_ons(p_restaurant_id uuid)
RETURNS TABLE (id uuid, name text, price text, image_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.price, d.image_url
  FROM public.dishes d
  WHERE d.restaurant_id = p_restaurant_id
    AND d.section = 'add_on'
    AND d.available = true
  ORDER BY d.sort_order ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_add_ons(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_add_ons(uuid) TO anon, authenticated;
