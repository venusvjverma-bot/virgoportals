/*
# Virgo Portals — core schema

## Overview
Creates the persistent store behind Virgo Portals so that data written by a host
survives a page refresh and is visible to the visitor page. This is the first
migration for the project.

## Access model (read this first)
Virgo Portals uses a *demo* login only (a fixed admin email/password and a fixed
host email/password). There is no Supabase Auth session, so the browser talks to
the database with the anon key and every row-level check would evaluate
`auth.uid()` as NULL. The owner column therefore stores the host's login email
(`owner_email`) and is the ownership key the application filters on. Policies are
scoped `TO anon, authenticated` with `USING (true)` because this is intentionally
a shared, single-tenant demo storefront with no end-user accounts; the login is a
demo gate, not a security boundary. When real accounts are added, replace these
policies with `auth.uid()`-scoped ones and add a `user_id` owner column.

## 1. New Tables

### `restaurants`
One row per restaurant portal.
- `id` (uuid, primary key) — portal id, also used in the visitor link.
- `owner_email` (text, unique, not null) — the host login email that owns this portal.
- `name` (text, not null, default '') — restaurant name shown to visitors.
- `city` (text, not null, default '') — restaurant city.
- `welcome` (text, not null, default '') — first message the visitor bot says (max 60 words enforced in the app).
- `system_prompt` (text, not null, default '') — this host's own bot instructions; seeded from the admin default, never overwrites the admin default.
- `created_at`, `updated_at` (timestamptz) — bookkeeping timestamps.

### `dishes`
One row per saved dish belonging to a restaurant.
- `id` (uuid, primary key)
- `restaurant_id` (uuid, not null) — parent portal, cascades on delete.
- `name` (text, not null, default '')
- `description` (text, not null, default '')
- `ingredients` (text, not null, default '')
- `allergy` (text, not null, default '')
- `price` (text, not null, default '')
- `image_url` (text, nullable) — generated dish image, set after a successful image generation.
- `sort_order` (integer, not null, default 0) — keeps upload order stable.
- `created_at`, `updated_at` (timestamptz)

### `app_config`
Key/value settings owned by the admin dashboard and read by the host and visitor sides.
- `key` (text, primary key) — `chatModel`, `imageModel`, or `botText`.
- `value` (jsonb, not null, default '{}') — the setting payload.
- `updated_at` (timestamptz)

### `usage_events`
Append-only activity log used to count uploads, generated images, and visitor messages.
- `id` (uuid, primary key)
- `restaurant_id` (uuid, nullable) — related portal.
- `kind` (text, not null) — one of `upload`, `image`, `message`.
- `created_at` (timestamptz)

## 2. Storage
- Creates a public `dish-images` bucket for generated dish photos.

## 3. Security
- Row level security is enabled on all four tables.
- Four policies per table (select/insert/update/delete) scoped `TO anon, authenticated`.
  As described above, this is deliberate for a demo login with no Supabase Auth session.
- Storage policies allow the anon-key client to read and upload into `dish-images`.

## 4. Seed data
- Inserts default rows for `chatModel`, `imageModel`, and `botText` so the admin
  dashboard and hosts share one source of truth. Existing rows are left untouched.
*/

CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  welcome text NOT NULL DEFAULT '',
  system_prompt text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  ingredients text NOT NULL DEFAULT '',
  allergy text NOT NULL DEFAULT '',
  price text NOT NULL DEFAULT '',
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('upload', 'image', 'message')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dishes_restaurant_id_idx ON dishes (restaurant_id);
CREATE INDEX IF NOT EXISTS usage_events_restaurant_id_idx ON usage_events (restaurant_id);
CREATE INDEX IF NOT EXISTS usage_events_kind_idx ON usage_events (kind);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_restaurants" ON restaurants;
CREATE POLICY "anon_select_restaurants" ON restaurants FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_restaurants" ON restaurants;
CREATE POLICY "anon_insert_restaurants" ON restaurants FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_restaurants" ON restaurants;
CREATE POLICY "anon_update_restaurants" ON restaurants FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_restaurants" ON restaurants;
CREATE POLICY "anon_delete_restaurants" ON restaurants FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_dishes" ON dishes;
CREATE POLICY "anon_select_dishes" ON dishes FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_dishes" ON dishes;
CREATE POLICY "anon_insert_dishes" ON dishes FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_dishes" ON dishes;
CREATE POLICY "anon_update_dishes" ON dishes FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_dishes" ON dishes;
CREATE POLICY "anon_delete_dishes" ON dishes FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_app_config" ON app_config;
CREATE POLICY "anon_select_app_config" ON app_config FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_config" ON app_config;
CREATE POLICY "anon_insert_app_config" ON app_config FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_config" ON app_config;
CREATE POLICY "anon_update_app_config" ON app_config FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_config" ON app_config;
CREATE POLICY "anon_delete_app_config" ON app_config FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_usage_events" ON usage_events;
CREATE POLICY "anon_select_usage_events" ON usage_events FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_usage_events" ON usage_events;
CREATE POLICY "anon_insert_usage_events" ON usage_events FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_usage_events" ON usage_events;
CREATE POLICY "anon_update_usage_events" ON usage_events FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_usage_events" ON usage_events;
CREATE POLICY "anon_delete_usage_events" ON usage_events FOR DELETE
TO anon, authenticated USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('dish-images', 'dish-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_dish_images" ON storage.objects;
CREATE POLICY "anon_read_dish_images" ON storage.objects FOR SELECT
TO anon, authenticated USING (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "anon_upload_dish_images" ON storage.objects;
CREATE POLICY "anon_upload_dish_images" ON storage.objects FOR INSERT
TO anon, authenticated WITH CHECK (bucket_id = 'dish-images');

DROP POLICY IF EXISTS "anon_update_dish_images" ON storage.objects;
CREATE POLICY "anon_update_dish_images" ON storage.objects FOR UPDATE
TO anon, authenticated USING (bucket_id = 'dish-images') WITH CHECK (bucket_id = 'dish-images');

INSERT INTO app_config (key, value) VALUES
  ('chatModel', $json${"provider":"OpenAI","apiKey":"","model":"gpt-4o-mini","endpoint":"https://api.openai.com/v1/chat/completions"}$json$::jsonb),
  ('imageModel', $json${"provider":"OpenAI","apiKey":"","model":"dall-e-3","endpoint":"https://api.openai.com/v1/images/generations"}$json$::jsonb),
  ('botText', $json${"text":"You are the restaurant host's menu assistant. Be friendly and professional. Answer only from this restaurant's saved menu. Do not take orders or payments. Keep the first welcome between 30 and 60 words."}$json$::jsonb)
ON CONFLICT (key) DO NOTHING;
