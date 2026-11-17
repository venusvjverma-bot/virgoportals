/*
# Create print_agents table (Printer Setup app registry)

1. Plain-English summary
Each restaurant that installs the new Virgo printing app on a Windows computer
gets one row in this table per installed computer. The row records which
departments that computer prints for, and a periodic heartbeat so the Host
Dashboard can show whether the app is currently connected. The printing app
signs in with the restaurant owner's existing Virgo Portal account; it never
uses or stores any service-role key.

2. New Tables
- `print_agents`
  - `id` (uuid, primary key, default gen_random_uuid)
  - `restaurant_id` (uuid, NOT NULL, references restaurants(id) on delete cascade) — the restaurant this installation belongs to
  - `name` (text, NOT NULL, default 'Printing app') — friendly label for the computer, e.g. "Front desk PC"
  - `app_version` (text, NULL) — version reported by the app
  - `department_ids` (uuid[], NOT NULL, default '{}') — departments this computer serves; each must belong to the same restaurant (enforced by trigger below)
  - `last_heartbeat_at` (timestamptz, NULL) — last time the app reported it was running
  - `last_seen_ip` (text, NULL) — local network diagnostics only, reported by the app
  - `created_at` / `updated_at` (timestamptz, NOT NULL, default now())

3. Modified Tables
- None. `print_jobs`, `departments`, and `restaurants` are untouched.

4. Security
- RLS enabled on `print_agents`.
- SELECT: restaurant owners (via existing `owns_restaurant`) and admins.
- INSERT: owners, with a WITH CHECK that the row belongs to a restaurant they own.
- UPDATE: owners, same check on both sides (an owner cannot move a row to another restaurant).
- DELETE: owners.
- All policies are TO authenticated only. No anon access.
- GRANT: SELECT, INSERT, UPDATE, DELETE to authenticated; full grants to service_role (used by the print-queue Edge Function for heartbeat updates).

5. Important notes
- Department membership trigger: `validate_print_agent_departments` (SECURITY DEFINER, pinned search_path) rejects a department id that belongs to a different restaurant, so one installation can never read another restaurant's print jobs by listing foreign departments.
- Heartbeat policy: the `print-queue` Edge Function (service role) also refreshes `last_heartbeat_at`, so the service_role grant is required.
*/

CREATE TABLE IF NOT EXISTS public.print_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Printing app',
  app_version text,
  department_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  last_heartbeat_at timestamptz,
  last_seen_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.print_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hosts_view_own_print_agents" ON public.print_agents;
CREATE POLICY "hosts_view_own_print_agents"
ON public.print_agents FOR SELECT
TO authenticated
USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "hosts_insert_own_print_agents" ON public.print_agents;
CREATE POLICY "hosts_insert_own_print_agents"
ON public.print_agents FOR INSERT
TO authenticated
WITH CHECK (public.owns_restaurant(restaurant_id));

DROP POLICY IF EXISTS "hosts_update_own_print_agents" ON public.print_agents;
CREATE POLICY "hosts_update_own_print_agents"
ON public.print_agents FOR UPDATE
TO authenticated
USING (public.owns_restaurant(restaurant_id))
WITH CHECK (public.owns_restaurant(restaurant_id));

DROP POLICY IF EXISTS "hosts_delete_own_print_agents" ON public.print_agents;
CREATE POLICY "hosts_delete_own_print_agents"
ON public.print_agents FOR DELETE
TO authenticated
USING (public.owns_restaurant(restaurant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_agents TO authenticated;
GRANT ALL ON public.print_agents TO service_role;

CREATE OR REPLACE FUNCTION public.validate_print_agent_departments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bad uuid;
BEGIN
  SELECT d.id INTO v_bad
  FROM unnest(COALESCE(NEW.department_ids, '{}'::uuid[])) AS d(id)
  JOIN public.departments dep ON dep.id = d.id
  WHERE dep.restaurant_id <> NEW.restaurant_id
  LIMIT 1;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Department % does not belong to this restaurant', v_bad;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_print_agent_departments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_print_agent_departments() TO authenticated;

DROP TRIGGER IF EXISTS print_agents_department_scope_trigger ON public.print_agents;
CREATE TRIGGER print_agents_department_scope_trigger
BEFORE INSERT OR UPDATE OF department_ids, restaurant_id ON public.print_agents
FOR EACH ROW EXECUTE FUNCTION public.validate_print_agent_departments();
