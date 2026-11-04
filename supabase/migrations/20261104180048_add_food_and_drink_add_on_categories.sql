/*
# Add Food Add-on and Drink Add-on categories

1. What changes
- Add-on dishes (section `add_on`) can now use two new categories alongside the existing one:
  - `food_add_ons` (Food Add-on): extras that go with food, such as toppings, sauces, sides or proteins.
  - `drink_add_ons` (Drink Add-on): extras that go with drinks, such as extra shots, syrups or milk alternatives.
- The existing `add_ons` category is kept. Records in it are not moved automatically; Hosts recategorize them by hand.
- No new table or column is created. The existing `dishes.category` column is reused.

2. Modified objects
- `dishes` category CHECK constraint (`dishes_category_valid`): the allowed list is widened with `food_add_ons` and `drink_add_ons`. No row is changed.
- `get_public_add_ons(p_restaurant_id, p_resource_type, p_resource_id)`: now also returns `category`. The function is dropped and recreated because its return type changes. Filter logic and scoping (restaurant, department, event) are unchanged.

3. Security
- The recreated public function is read-only and SECURITY DEFINER with a fixed search_path.
- EXECUTE is revoked from PUBLIC and granted only to `anon`, `authenticated` and `service_role`.
- No table policies or table grants change.

4. Notes
- Adding values to a CHECK constraint is safe because the new list is a strict superset of the old one.
- Existing add-on rows, prices, availability and scoping are untouched.
*/

ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_category_valid;
ALTER TABLE public.dishes ADD CONSTRAINT dishes_category_valid
  CHECK (category IN (
    'starters_appetizers', 'main_courses', 'soups', 'salads', 'sides',
    'desserts', 'kids_menu', 'specials',
    'coffee_tea', 'soft_drinks_water', 'juices', 'mocktails',
    'cocktails', 'beer_cider', 'wine', 'spirits_shots', 'non_alcoholic_beer',
    'add_ons', 'food_add_ons', 'drink_add_ons'
  ));

DROP FUNCTION IF EXISTS public.get_public_add_ons(uuid, text, uuid);

CREATE FUNCTION public.get_public_add_ons(
  p_restaurant_id uuid,
  p_resource_type text DEFAULT 'restaurant',
  p_resource_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, price text, image_url text, category text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT d.id, d.name, d.price, d.image_url, d.category
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

REVOKE EXECUTE ON FUNCTION public.get_public_add_ons(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_add_ons(uuid, text, uuid) TO anon, authenticated, service_role;
