/*
# Add public RPC for dish images by resource

## Plain English

Adds a new public function `get_public_dish_images` that returns only the
`image_url` column for available dishes belonging to a specific department
or event. This is used by the visitor welcome screen to build the animated
food-image background.

The function accepts a resource ID and resource type ('department' or
'event'), queries the dishes table scoped to that resource, and returns
only rows where `image_url IS NOT NULL` and `available = true`. No dish
names, prices, ingredients, or other sensitive data are exposed — only
image paths.

## New Functions

- `get_public_dish_images(p_resource_id uuid, p_resource_type text)`
  Returns `TABLE(image_url text)` — up to 12 image paths for dishes in the
  specified resource, ordered by sort_order.

## Security

- SECURITY DEFINER with `search_path = public` — safe, no mutable search path.
- Grants EXECUTE to `anon` and `authenticated` so the visitor frontend
  (anon key) can call it without a login.
- Only exposes `image_url`; no other dish fields are returned.
- The underlying `dish-images` storage bucket already has a public read
  policy for valid dish image paths.

## Important notes

1. The 12-row limit prevents excessive payload and image loading on mobile.
2. Only dishes with a non-null `image_url` and `available = true` are returned.
3. For 'restaurant' resource type, returns images for dishes with no
   department_id and no event_id (the restaurant's default/standalone dishes).
*/
