/*
# Theme assets — admin image library

## 1. New table: `theme_assets`
Stores metadata for images uploaded by administrators through the
admin dashboard's Theme Uploader section. Each row represents one
saved image file in the `theme-assets` storage bucket.

- `id` (uuid, primary key, generated) — unique persistent asset ID
- `filename` (text, not null) — original filename from upload
- `storage_path` (text, not null) — path within the `theme-assets` bucket
- `content_type` (text, not null) — MIME type (image/jpeg, image/png, image/apng)
- `size_bytes` (integer, not null) — file size in bytes
- `created_at` (timestamptz, default now)

## 2. New storage bucket: `theme-assets`
- `public = true` — these are visual theme assets meant to be displayed
  in the admin dashboard gallery and previews.
- Path convention: `<assetId>.<ext>` — each file uses its asset UUID.

## 3. Security — RLS on `theme_assets`
The table is admin-only. All CRUD policies use `is_admin()` (the
existing SECURITY DEFINER helper) so only admin users can list, insert,
update, or delete theme asset records. Hosts and anonymous users get
no access.

## 4. Storage policies on `theme-assets` bucket
- SELECT: `anon, authenticated` — public read so images display in the
  dashboard without per-request signed URLs.
- INSERT / UPDATE / DELETE: `authenticated` only, gated by `is_admin()`.

## 5. Notes
- Safe to re-run: table and bucket use IF NOT EXISTS, policies dropped
  first.
- No existing tables, columns, or policies are modified.
- `is_admin()` already exists from the auth-foundation migration.
*/

CREATE TABLE IF NOT EXISTS theme_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE theme_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_theme_assets" ON theme_assets;
CREATE POLICY "admin_select_theme_assets" ON theme_assets FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_theme_assets" ON theme_assets;
CREATE POLICY "admin_insert_theme_assets" ON theme_assets FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_theme_assets" ON theme_assets;
CREATE POLICY "admin_update_theme_assets" ON theme_assets FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_theme_assets" ON theme_assets;
CREATE POLICY "admin_delete_theme_assets" ON theme_assets FOR DELETE
  TO authenticated USING (public.is_admin());

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('theme-assets', 'theme-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for theme assets
DROP POLICY IF EXISTS "public_read_theme_assets" ON storage.objects;
CREATE POLICY "public_read_theme_assets" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'theme-assets');

-- Admin-only writes
DROP POLICY IF EXISTS "admin_insert_theme_assets_storage" ON storage.objects;
CREATE POLICY "admin_insert_theme_assets_storage" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'theme-assets' AND public.is_admin());

DROP POLICY IF EXISTS "admin_update_theme_assets_storage" ON storage.objects;
CREATE POLICY "admin_update_theme_assets_storage" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'theme-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'theme-assets' AND public.is_admin());

DROP POLICY IF EXISTS "admin_delete_theme_assets_storage" ON storage.objects;
CREATE POLICY "admin_delete_theme_assets_storage" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'theme-assets' AND public.is_admin());
