/*
# Virgo Portals — secure storage

## Overview
Replaces the wide-open `dish-images` storage policies (any role could read,
upload and overwrite any path) with ownership-scoped ones, and adds a PRIVATE
bucket for host-uploaded menu documents so they are no longer publicly
downloadable or overwritable by anonymous users.

## 1. New private bucket: `menu-files`
- `public = false`. Host menu PDFs/photos are private business documents, not
  public assets. They are read only through the `menu-extract` edge function
  using the service role, never through a public URL.
- Path convention: `<restaurantId>/<uuid>.<ext>` — the first folder segment is
  the owning restaurant, which is what every policy checks.

## 2. Helper function: `public.owns_storage_path(text)`
Safely parses the first path segment as a uuid and reports whether the caller
owns that restaurant. An unparseable path returns `false` rather than raising, so
a malformed name cannot error the policy. `SECURITY DEFINER`, pinned
`search_path`, boolean-only return.

## 3. Policies
### `dish-images` (still public for visitor-facing dish photos)
- SELECT: `anon, authenticated` — dish photos are shown to visitors by design.
- INSERT / UPDATE / DELETE: `authenticated` only, and only inside the caller's
  own `<restaurantId>/…` folder. This stops one host (or any anonymous visitor)
  from writing into or overwriting another host's images.
### `menu-files` (private)
- SELECT / INSERT / UPDATE / DELETE: `authenticated` only, scoped to the caller's
  own `<restaurantId>/…` folder. No `anon` policy at all, so anonymous users can
  neither list, read, upload, overwrite nor delete menu documents.

## 4. Old policy removal
The three original policies `anon_read_dish_images`, `anon_upload_dish_images`
and `anon_update_dish_images` are dropped. A broad public DELETE policy is NOT
created — cleanup is done through the service role only.

## 5. Notes
- Safe to re-run: bucket created with `ON CONFLICT DO NOTHING`, all policies
  dropped with `IF EXISTS` first.
- Existing dish images keep working unchanged (their paths already begin with the
  restaurant id).
*/

CREATE OR REPLACE FUNCTION public.owns_storage_path(p_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder text;
  v_uuid uuid;
BEGIN
  v_folder := (storage.foldername(p_name))[1];
  IF v_folder IS NULL OR v_folder = '' THEN
    RETURN false;
  END IF;
  BEGIN
    v_uuid := v_folder::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  RETURN public.owns_restaurant(v_uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.owns_storage_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_storage_path(text) TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-files', 'menu-files', false)
ON CONFLICT (id) DO NOTHING;

-- dish-images: keep public read, restrict writes to the owning host
DROP POLICY IF EXISTS "anon_read_dish_images" ON storage.objects;
DROP POLICY IF EXISTS "anon_upload_dish_images" ON storage.objects;
DROP POLICY IF EXISTS "anon_update_dish_images" ON storage.objects;

DROP POLICY IF EXISTS "public_read_dish_images" ON storage.objects;
CREATE POLICY "public_read_dish_images" ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "host_insert_dish_images" ON storage.objects;
CREATE POLICY "host_insert_dish_images" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dish-images' AND public.owns_storage_path(name));

DROP POLICY IF EXISTS "host_update_dish_images" ON storage.objects;
CREATE POLICY "host_update_dish_images" ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'dish-images' AND public.owns_storage_path(name))
WITH CHECK (bucket_id = 'dish-images' AND public.owns_storage_path(name));

DROP POLICY IF EXISTS "host_delete_dish_images" ON storage.objects;
CREATE POLICY "host_delete_dish_images" ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dish-images' AND public.owns_storage_path(name));

-- menu-files: private, owner-only
DROP POLICY IF EXISTS "host_select_menu_files" ON storage.objects;
CREATE POLICY "host_select_menu_files" ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'menu-files' AND public.owns_storage_path(name));

DROP POLICY IF EXISTS "host_insert_menu_files" ON storage.objects;
CREATE POLICY "host_insert_menu_files" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-files' AND public.owns_storage_path(name));

DROP POLICY IF EXISTS "host_update_menu_files" ON storage.objects;
CREATE POLICY "host_update_menu_files" ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'menu-files' AND public.owns_storage_path(name))
WITH CHECK (bucket_id = 'menu-files' AND public.owns_storage_path(name));

DROP POLICY IF EXISTS "host_delete_menu_files" ON storage.objects;
CREATE POLICY "host_delete_menu_files" ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-files' AND public.owns_storage_path(name));
