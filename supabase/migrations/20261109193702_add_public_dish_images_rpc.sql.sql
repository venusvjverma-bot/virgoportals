/*
# Add public RPC for dish images by resource

Adds `get_public_dish_images(p_resource_id uuid, p_resource_type text)`
returning up to 12 image_url values for available dishes in the specified
department or event. Used by the visitor welcome screen background.

Security: SECURITY DEFINER, search_path=public, EXECUTE granted to
anon+authenticated. Only image_url is exposed — no names, prices, etc.
*/

CREATE OR REPLACE FUNCTION public.get_public_dish_images(
  p_resource_id uuid,
  p_resource_type text
) RETURNS TABLE(image_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_resource_type = 'department' THEN
    RETURN QUERY
    SELECT d.image_url
    FROM dishes d
    WHERE d.department_id = p_resource_id
      AND d.image_url IS NOT NULL
      AND d.image_url <> ''
      AND d.available = true
    ORDER BY d.sort_order
    LIMIT 12;

  ELSIF p_resource_type = 'event' THEN
    RETURN QUERY
    SELECT d.image_url
    FROM dishes d
    WHERE d.event_id = p_resource_id
      AND d.image_url IS NOT NULL
      AND d.image_url <> ''
      AND d.available = true
    ORDER BY d.sort_order
    LIMIT 12;

  ELSIF p_resource_type = 'restaurant' THEN
    RETURN QUERY
    SELECT d.image_url
    FROM dishes d
    WHERE d.restaurant_id = p_resource_id
      AND d.department_id IS NULL
      AND d.event_id IS NULL
      AND d.image_url IS NOT NULL
      AND d.image_url <> ''
      AND d.available = true
    ORDER BY d.sort_order
    LIMIT 12;
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_dish_images(uuid, text) TO anon, authenticated;
