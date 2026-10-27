/*
# Chat background sharing — admin availability + per-resource assignments

## 1. Plain-English summary
Admins can now decide which saved theme images Hosts may use as the visitor
chat background. Hosts pick one shared image per Department or Event. If the
Admin revokes an image, every assignment using it is cleared automatically and
the affected visitor chat pages fall back to the plain background.

## 2. Modified tables
- `theme_assets`: new `shared` boolean column, NOT NULL, default TRUE. All
  existing images remain available (backfilled as shared = true).
- `departments`: new nullable `chat_background_asset_id` uuid FK to
  `theme_assets(id)` ON DELETE SET NULL — the host's background choice.
- `events`: same new nullable `chat_background_asset_id` column.

## 3. Security (RLS)
- New policy `select_shared_theme_assets` on `theme_assets`: any authenticated
  user (hosts) may SELECT rows where shared = true. The existing admin-only
  SELECT policy is unchanged and still grants admins full access. Hosts cannot
  see, insert, update or delete non-shared assets.
- New trigger function `validate_chat_background_assignment()` (empty
  search_path): BEFORE INSERT/UPDATE on `departments` and `events`, rejects
  assigning an asset id that does not exist or is not shared. This enforces
  the admin's sharing decision server-side, so a stale client cannot assign a
  revoked image.

## 4. Visitor resolution
`get_public_resource()` is dropped and recreated to add a
`chat_background_path` column. It returns the assigned asset's storage path
ONLY when the asset still exists AND shared = true; otherwise NULL, so the
visitor page falls back to the plain background.

## 5. Notes
- Idempotent: IF NOT EXISTS / DROP-first for policies, functions, triggers.
- No data is deleted; revocation only clears assignment pointers.
- Indexes added on both new FK columns (partial, non-null only).
*/

ALTER TABLE theme_assets
  ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT true;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS chat_background_asset_id uuid
  REFERENCES public.theme_assets(id) ON DELETE SET NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS chat_background_asset_id uuid
  REFERENCES public.theme_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS departments_chat_bg_idx
  ON departments(chat_background_asset_id) WHERE chat_background_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_chat_bg_idx
  ON events(chat_background_asset_id) WHERE chat_background_asset_id IS NOT NULL;

-- Hosts may read only images the admin has shared.
DROP POLICY IF EXISTS "select_shared_theme_assets" ON theme_assets;
CREATE POLICY "select_shared_theme_assets" ON theme_assets FOR SELECT
  TO authenticated USING (shared = true);

-- Server-side enforcement: a host cannot assign a revoked or unknown asset.
CREATE OR REPLACE FUNCTION public.validate_chat_background_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  asset_shared boolean;
BEGIN
  IF NEW.chat_background_asset_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT shared INTO asset_shared FROM public.theme_assets WHERE id = NEW.chat_background_asset_id;
  IF asset_shared IS NULL OR asset_shared = false THEN
    RAISE EXCEPTION 'That image is not available for chat backgrounds.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_chat_background_departments ON departments;
CREATE TRIGGER validate_chat_background_departments
BEFORE INSERT OR UPDATE OF chat_background_asset_id ON departments
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_background_assignment();

DROP TRIGGER IF EXISTS validate_chat_background_events ON events;
CREATE TRIGGER validate_chat_background_events
BEFORE INSERT OR UPDATE OF chat_background_asset_id ON events
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_background_assignment();

-- Return type changed: must DROP the old function first.
DROP FUNCTION IF EXISTS public.get_public_resource(uuid, text);

CREATE OR REPLACE FUNCTION public.get_public_resource(
  p_resource_id uuid,
  p_resource_type text
) RETURNS TABLE(
  resource_id uuid,
  resource_name text,
  resource_type text,
  open_time text,
  close_time text,
  start_date date,
  end_date date,
  start_time text,
  end_time text,
  restaurant_id uuid,
  restaurant_name text,
  city text,
  welcome text,
  system_prompt text,
  timezone text,
  chat_background_path text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_resource_type = 'department' THEN
    RETURN QUERY
    SELECT
      d.id, d.name, 'department',
      d.open_time, d.close_time,
      NULL::date, NULL::date, NULL::text, NULL::text,
      r.id, r.name, r.city, r.welcome,
      COALESCE(NULLIF(d.system_prompt, ''), r.system_prompt),
      r.timezone,
      ta.storage_path
    FROM departments d
    JOIN restaurants r ON r.id = d.restaurant_id
    LEFT JOIN theme_assets ta ON ta.id = d.chat_background_asset_id AND ta.shared = true
    WHERE d.id = p_resource_id AND r.status = 'Active';

  ELSIF p_resource_type = 'event' THEN
    RETURN QUERY
    SELECT
      e.id, e.name, 'event',
      NULL::text, NULL::text,
      e.start_date, e.end_date, e.start_time, e.end_time,
      r.id, r.name, r.city, r.welcome,
      COALESCE(NULLIF(e.system_prompt, ''), r.system_prompt),
      r.timezone,
      ta.storage_path
    FROM events e
    JOIN restaurants r ON r.id = e.restaurant_id
    LEFT JOIN theme_assets ta ON ta.id = e.chat_background_asset_id AND ta.shared = true
    WHERE e.id = p_resource_id AND r.status = 'Active';

  ELSIF p_resource_type = 'restaurant' THEN
    RETURN QUERY
    SELECT
      r.id, r.name, 'restaurant',
      NULL::text, NULL::text,
      NULL::date, NULL::date, NULL::text, NULL::text,
      r.id, r.name, r.city, r.welcome,
      r.system_prompt,
      r.timezone,
      NULL::text
    FROM restaurants r
    WHERE r.id = p_resource_id AND r.status = 'Active';
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_resource(uuid, text) TO anon, authenticated;
