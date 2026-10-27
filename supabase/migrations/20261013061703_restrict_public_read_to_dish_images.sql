/*
# Restrict public read of the dish-images bucket to actual dish images

## Plain English

The `dish-images` bucket is public because visitor menus need to show dish
photos without a login. Before this change, every file in that bucket was
readable by anyone, including the menu PDFs and menu photos that hosts uploaded
under the `menus/` prefix in the old design. Those uploads are not dish photos
and should never have been world readable.

This migration narrows the public read rule so only real dish images are
public. Anything stored under the legacy `menus/` prefix is no longer readable
or listable by a visitor.

## Security changes

- Drops the `public_read_dish_images` SELECT policy on `storage.objects`.
- Creates a replacement SELECT policy for `anon` and `authenticated` that
  requires `bucket_id = 'dish-images'` AND the first path segment is not
  `menus`.

## Important notes

1. Dish images are written by the dish-image service at
   `<restaurantId>/<dishId>-<timestamp>.png`, so their first path segment is a
   restaurant id and they remain publicly readable exactly as before.
2. Host menu uploads now go to the private `menu-files` bucket, so nothing in
   the app reads the legacy `menus/` objects. This change removes access to them
   without removing the files themselves.
3. No object is deleted by this migration.
*/

DROP POLICY IF EXISTS "public_read_dish_images" ON storage.objects;

CREATE POLICY "public_read_dish_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'dish-images'
  AND (storage.foldername(name))[1] <> 'menus'
);
