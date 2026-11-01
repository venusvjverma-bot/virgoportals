/*
# Save extracted menu dishes atomically

1. What changes
- Adds `save_extracted_menu_dishes`, a function the menu upload calls once per upload.
- It inserts each dish row and its serving-size rows inside one database transaction.
- If any serving-size row fails, the whole upload is rolled back, so no dish is saved without its sizes.

2. Security
- The function is callable only by the server role that runs the menu upload function.
- EXECUTE is revoked from PUBLIC, anon and authenticated, so visitors and hosts cannot call it directly.
- No table policies are changed.

3. Notes
- Dish rows and serving rows are written in the order supplied, so the returned dishes match the input order.
- Re-running this migration is safe: the function is replaced if it already exists.
*/

CREATE OR REPLACE FUNCTION public.save_extracted_menu_dishes(
  p_restaurant_id uuid,
  p_department_id uuid,
  p_event_id uuid,
  p_base_sort integer,
  p_dishes jsonb
)
RETURNS SETOF public.dishes
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  dish_item record;
  saved_dish public.dishes;
  option_item jsonb;
  option_order integer;
BEGIN
  FOR dish_item IN
    SELECT item, idx FROM jsonb_array_elements(p_dishes) WITH ORDINALITY AS e(item, idx)
  LOOP
    INSERT INTO public.dishes (
      restaurant_id, department_id, event_id, name, section, category,
      description, ingredients, allergy, price, serving, abv, sort_order
    )
    VALUES (
      p_restaurant_id,
      p_department_id,
      p_event_id,
      dish_item.item->>'name',
      dish_item.item->>'section',
      dish_item.item->>'category',
      dish_item.item->>'description',
      dish_item.item->>'ingredients',
      dish_item.item->>'allergy',
      dish_item.item->>'price',
      dish_item.item->>'serving',
      dish_item.item->>'abv',
      p_base_sort + (dish_item.idx - 1)::integer
    )
    RETURNING * INTO saved_dish;

    option_order := 0;
    FOR option_item IN SELECT value FROM jsonb_array_elements(COALESCE(dish_item.item->'options', '[]'::jsonb)) AS o(value)
    LOOP
      INSERT INTO public.dish_serving_options (dish_id, label, price, sort_order)
      VALUES (saved_dish.id, option_item->>'label', option_item->>'price', option_order);
      option_order := option_order + 1;
    END LOOP;

    RETURN NEXT saved_dish;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_extracted_menu_dishes(uuid, uuid, uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_extracted_menu_dishes(uuid, uuid, uuid, integer, jsonb) TO service_role;
