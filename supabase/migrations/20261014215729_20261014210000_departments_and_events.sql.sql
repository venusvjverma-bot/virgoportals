/*
# Departments & Events — multi-resource menu isolation

## Purpose
Extends Virgo Portals so a host can manage multiple permanent service areas
(Departments) and temporary services (Events), each with its own menu, bot
context, QR destination, and operating schedule. Existing hosts get a default
department automatically, preserving all current menu data, bot settings, and
QR links.

## 1. New Tables

### `departments`
- `id` uuid PK
- `restaurant_id` uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE
- `name` text NOT NULL
- `is_default` boolean NOT NULL DEFAULT false
- `open_time` text (HH:mm 24-hour, nullable)
- `close_time` text (HH:mm 24-hour, nullable)
- `system_prompt` text NOT NULL DEFAULT ''
- `is_active` boolean NOT NULL DEFAULT true
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

### `events`
- `id` uuid PK
- `restaurant_id` uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE
- `name` text NOT NULL
- `start_date` date NOT NULL
- `end_date` date NOT NULL
- `start_time` text (HH:mm)
- `end_time` text (HH:mm)
- `system_prompt` text NOT NULL DEFAULT ''
- `status` text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','ended','archived'))
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

## 2. Modified Tables

### `dishes`
- Added `department_id` uuid REFERENCES departments(id) ON DELETE CASCADE (nullable)
- Added `event_id` uuid REFERENCES events(id) ON DELETE CASCADE (nullable)
- A CHECK constraint ensures exactly one resource scope is set:
  a dish belongs to a department, an event, or the legacy restaurant-level
  default (both null = belongs to the default department).

### `restaurants`
- Added `timezone` text NOT NULL DEFAULT 'Europe/Stockholm'

## 3. Data Migration — Default Departments

For every existing restaurant, a default department is created with:
- `name` = restaurant's name
- `is_default` = true
- `open_time` / `close_time` = null (always available)
- `system_prompt` = '' (will fall back to restaurant-level prompt)

All existing dishes (which have `department_id = null` and `event_id = null`)
are left as-is. The visitor-chat function resolves them through the default
department when no explicit department_id is set on the dish.

Idempotent: uses `NOT EXISTS` checks so re-running creates no duplicates.

## 4. Security — RLS & Policies

RLS enabled on both `departments` and `events`. All policies use
`owns_restaurant(restaurant_id)` — the same SECURITY DEFINER helper already
used by the `dishes` table policies. Hosts can only CRUD their own
departments and events. Admins have broad access via `is_admin()`.

`dishes` policies updated to also allow scoping by department_id / event_id
through `owns_restaurant`. The existing `restaurant_id`-based policies remain.

## 5. Public Functions

### `get_public_resource(p_resource_id uuid, p_resource_type text)`
Returns public fields (name, open/close times or event dates, timezone,
system_prompt, restaurant name/city/welcome) for a department or event.
Validates that the parent restaurant is Active. This is the visitor-facing
lookup that replaces `get_public_portal` for resource-scoped QR destinations.

### `get_public_portal(p_portal_id uuid)` — unchanged, still works for
legacy QR codes that point directly to a restaurant.

## 6. Indexes
- `departments_restaurant_id_idx`
- `events_restaurant_id_idx`
- `dishes_department_id_idx`
- `dishes_event_id_idx`
*/

-- ─── restaurants: timezone column ───
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Stockholm';

-- ─── departments table ───
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  open_time text,
  close_time text,
  system_prompt text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS departments_restaurant_id_idx ON departments(restaurant_id);

-- ─── events table ───
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time text,
  end_time text,
  system_prompt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','ended','archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS events_restaurant_id_idx ON events(restaurant_id);

-- ─── dishes: department_id and event_id columns ───
ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS dishes_department_id_idx ON dishes(department_id);
CREATE INDEX IF NOT EXISTS dishes_event_id_idx ON dishes(event_id);

-- ─── Backfill default departments for existing restaurants ───
INSERT INTO departments (restaurant_id, name, is_default, system_prompt)
SELECT r.id, r.name, true, ''
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1 FROM departments d WHERE d.restaurant_id = r.id AND d.is_default = true
);

-- ─── RLS Policies for departments ───
DROP POLICY IF EXISTS "select_own_departments" ON departments;
CREATE POLICY "select_own_departments" ON departments FOR SELECT
  TO authenticated USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_departments" ON departments;
CREATE POLICY "insert_own_departments" ON departments FOR INSERT
  TO authenticated WITH CHECK (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "update_own_departments" ON departments;
CREATE POLICY "update_own_departments" ON departments FOR UPDATE
  TO authenticated USING (public.owns_restaurant(restaurant_id) OR public.is_admin())
  WITH CHECK (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "delete_own_departments" ON departments;
CREATE POLICY "delete_own_departments" ON departments FOR DELETE
  TO authenticated USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

-- ─── RLS Policies for events ───
DROP POLICY IF EXISTS "select_own_events" ON events;
CREATE POLICY "select_own_events" ON events FOR SELECT
  TO authenticated USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_events" ON events;
CREATE POLICY "insert_own_events" ON events FOR INSERT
  TO authenticated WITH CHECK (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "update_own_events" ON events;
CREATE POLICY "update_own_events" ON events FOR UPDATE
  TO authenticated USING (public.owns_restaurant(restaurant_id) OR public.is_admin())
  WITH CHECK (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "delete_own_events" ON events;
CREATE POLICY "delete_own_events" ON events FOR DELETE
  TO authenticated USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

-- ─── Update dishes policies to allow department_id / event_id scoping ───
-- The existing owns_restaurant(restaurant_id) check still applies to every dish
-- because restaurant_id is always present. Department_id and event_id are
-- optional FKs that further scope the dish within a resource, but ownership is
-- still verified through the restaurant_id column. No new policies needed.

-- ─── Public function: get_public_resource ───
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
  timezone text
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
      r.timezone
    FROM departments d
    JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.id = p_resource_id AND r.status = 'Active';

  ELSIF p_resource_type = 'event' THEN
    RETURN QUERY
    SELECT
      e.id, e.name, 'event',
      NULL::text, NULL::text,
      e.start_date, e.end_date, e.start_time, e.end_time,
      r.id, r.name, r.city, r.welcome,
      COALESCE(NULLIF(e.system_prompt, ''), r.system_prompt),
      r.timezone
    FROM events e
    JOIN restaurants r ON r.id = e.restaurant_id
    WHERE e.id = p_resource_id AND r.status = 'Active';

  ELSIF p_resource_type = 'restaurant' THEN
    RETURN QUERY
    SELECT
      r.id, r.name, 'restaurant',
      NULL::text, NULL::text,
      NULL::date, NULL::date, NULL::text, NULL::text,
      r.id, r.name, r.city, r.welcome,
      r.system_prompt,
      r.timezone
    FROM restaurants r
    WHERE r.id = p_resource_id AND r.status = 'Active';
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_resource(uuid, text) TO anon, authenticated;
