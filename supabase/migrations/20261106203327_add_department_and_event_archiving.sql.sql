/*
# Department and Event archiving

1. Plain-English summary
- Resources (departments and events) that have historical orders cannot be permanently
  deleted, because deleting them would cascade-delete their dishes which are pinned by
  `order_items.dish_id` (ON DELETE RESTRICT). Instead, hosts archive them: the record, its
  ID, its dishes, combos and every historical order stay exactly as they are, but the
  resource disappears from active Host lists and can no longer receive new orders.
- Resources with no orders can still be permanently deleted as before.

2. Modified tables
- `departments`: new column `archived` (boolean, NOT NULL, default false). Existing rows
  are untouched and read as "not archived".

3. Modified functions
- `get_public_resource(uuid, text)`: department and event branches now exclude archived
  resources, so visitors cannot open a chat / order flow through an archived department
  or event. Restaurant-level access is unchanged.

4. Events
- `events` already has a `status` column whose CHECK constraint includes 'archived'
  (migration 20261014215729). Archiving an event sets that existing status; no schema
  change is needed for events.

5. Security
- No new tables, policies or grants. `archived` is covered by the existing table-level
  grants and RLS policies on `departments` (owner-scoped).
- The visitor ordering edge function must also reject archived resources (done in code).
*/

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

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
  chat_background_path text,
  currency text
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
      ta.storage_path,
      r.currency
    FROM departments d
    JOIN restaurants r ON r.id = d.restaurant_id
    LEFT JOIN theme_assets ta ON ta.id = d.chat_background_asset_id AND ta.shared = true
    WHERE d.id = p_resource_id AND d.archived = false AND r.status = 'Active';

  ELSIF p_resource_type = 'event' THEN
    RETURN QUERY
    SELECT
      e.id, e.name, 'event',
      NULL::text, NULL::text,
      e.start_date, e.end_date, e.start_time, e.end_time,
      r.id, r.name, r.city, r.welcome,
      COALESCE(NULLIF(e.system_prompt, ''), r.system_prompt),
      r.timezone,
      ta.storage_path,
      r.currency
    FROM events e
    JOIN restaurants r ON r.id = e.restaurant_id
    LEFT JOIN theme_assets ta ON ta.id = e.chat_background_asset_id AND ta.shared = true
    WHERE e.id = p_resource_id AND e.status <> 'archived' AND r.status = 'Active';

  ELSIF p_resource_type = 'restaurant' THEN
    RETURN QUERY
    SELECT
      r.id, r.name, 'restaurant',
      NULL::text, NULL::text,
      NULL::date, NULL::date, NULL::text, NULL::text,
      r.id, r.name, r.city, r.welcome,
      r.system_prompt,
      r.timezone,
      NULL::text,
      r.currency
    FROM restaurants r
    WHERE r.id = p_resource_id AND r.status = 'Active';
  END IF;

  RETURN;
END;
$$;
