/*
# Virgo Portals — least-privilege RLS rewrite

## Overview
Replaces the four wide-open `USING (true)` / `WITH CHECK (true)` policies that
existed on every table (scoped `TO anon, authenticated`) with ownership-checked,
role-scoped policies. This is the fix for the confirmed anonymous write access
found in the security audit.

## 1. Helper functions (SECURITY DEFINER, boolean only)
- `public.is_admin()` — true when `auth.uid()` appears in `admin_users`.
- `public.owns_restaurant(uuid)` — true when the given restaurant's `owner_id`
  equals `auth.uid()`.
Both are `SECURITY DEFINER` with a pinned `search_path` and return only a
boolean, so they leak nothing. They exist so policies do not have to re-query
the `restaurants` table inline (which would recurse through its own RLS).
`EXECUTE` is granted to `authenticated` because policies run as the caller.
No `anon` grant is needed: no anon policy calls them.

## 2. Policy model per table
### `restaurants`
- SELECT: host sees their own row; admin sees all. No anon access.
- INSERT: admin only (hosts are provisioned by the admin).
- UPDATE: host may update their own row; admin any. The `WITH CHECK` repeats the
  ownership predicate so a host cannot reassign `owner_id` to another account.
- DELETE: admin only.
### `dishes`
- SELECT/INSERT/UPDATE/DELETE: only when the caller owns the parent restaurant
  (or is admin). INSERT and UPDATE `WITH CHECK` re-verify ownership, so a dish
  cannot be created in, or moved into, another host's restaurant.
### `app_config`
- SELECT: admin sees all keys; authenticated hosts may read only the `botText`
  key (the default prompt they start from). No anon access.
- INSERT/UPDATE/DELETE: admin only.
### `usage_events`
- SELECT: host sees their own restaurant's events; admin sees all.
- INSERT/UPDATE/DELETE: admin only. The edge functions write these with the
  service role, which bypasses RLS.

## 3. Protected-column guard on `restaurants`
A `BEFORE UPDATE` trigger reverts `owner_id`, `owner_email` and `status` to their
previous values for any caller who is not the admin or the service role. This
stops a host from promoting themselves out of a `Blocked` state or handing their
restaurant to another account through a direct API update, even if a policy were
later loosened by mistake.

## 4. Visitor-facing access
`anon` keeps NO direct table access at all. The visitor page reads its public
fields through `public.get_public_portal(uuid)` (created in the previous
migration), which returns only id, name, city and welcome for an `Active`
restaurant. Menu content and chat replies are served by the `visitor-chat`
edge function using the service role, which never exposes system prompts.

## 5. Notes
- Safe to re-run: every policy is dropped with `IF EXISTS` before creation.
- No table, column or row is dropped. Existing data is untouched.
- Grants are left as they were for the tables the app still reads directly; the
  policies are what now restrict row visibility.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.owns_restaurant(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND r.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_restaurant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_restaurant(uuid) TO authenticated;

-- restaurants
DROP POLICY IF EXISTS "anon_select_restaurants" ON restaurants;
DROP POLICY IF EXISTS "anon_insert_restaurants" ON restaurants;
DROP POLICY IF EXISTS "anon_update_restaurants" ON restaurants;
DROP POLICY IF EXISTS "anon_delete_restaurants" ON restaurants;

DROP POLICY IF EXISTS "host_select_own_restaurant" ON restaurants;
CREATE POLICY "host_select_own_restaurant" ON restaurants FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "admin_insert_restaurant" ON restaurants;
CREATE POLICY "admin_insert_restaurant" ON restaurants FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "host_update_own_restaurant" ON restaurants;
CREATE POLICY "host_update_own_restaurant" ON restaurants FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR public.is_admin())
WITH CHECK (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "admin_delete_restaurant" ON restaurants;
CREATE POLICY "admin_delete_restaurant" ON restaurants FOR DELETE
TO authenticated
USING (public.is_admin());

-- dishes
DROP POLICY IF EXISTS "anon_select_dishes" ON dishes;
DROP POLICY IF EXISTS "anon_insert_dishes" ON dishes;
DROP POLICY IF EXISTS "anon_update_dishes" ON dishes;
DROP POLICY IF EXISTS "anon_delete_dishes" ON dishes;

DROP POLICY IF EXISTS "host_select_own_dishes" ON dishes;
CREATE POLICY "host_select_own_dishes" ON dishes FOR SELECT
TO authenticated
USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "host_insert_own_dishes" ON dishes;
CREATE POLICY "host_insert_own_dishes" ON dishes FOR INSERT
TO authenticated
WITH CHECK (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "host_update_own_dishes" ON dishes;
CREATE POLICY "host_update_own_dishes" ON dishes FOR UPDATE
TO authenticated
USING (public.owns_restaurant(restaurant_id) OR public.is_admin())
WITH CHECK (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "host_delete_own_dishes" ON dishes;
CREATE POLICY "host_delete_own_dishes" ON dishes FOR DELETE
TO authenticated
USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

-- app_config
DROP POLICY IF EXISTS "anon_select_app_config" ON app_config;
DROP POLICY IF EXISTS "anon_insert_app_config" ON app_config;
DROP POLICY IF EXISTS "anon_update_app_config" ON app_config;
DROP POLICY IF EXISTS "anon_delete_app_config" ON app_config;

DROP POLICY IF EXISTS "authenticated_select_bot_text" ON app_config;
CREATE POLICY "authenticated_select_bot_text" ON app_config FOR SELECT
TO authenticated
USING (public.is_admin() OR key = 'botText');

DROP POLICY IF EXISTS "admin_insert_app_config" ON app_config;
CREATE POLICY "admin_insert_app_config" ON app_config FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_app_config" ON app_config;
CREATE POLICY "admin_update_app_config" ON app_config FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_app_config" ON app_config;
CREATE POLICY "admin_delete_app_config" ON app_config FOR DELETE
TO authenticated
USING (public.is_admin());

-- usage_events
DROP POLICY IF EXISTS "anon_select_usage_events" ON usage_events;
DROP POLICY IF EXISTS "anon_insert_usage_events" ON usage_events;
DROP POLICY IF EXISTS "anon_update_usage_events" ON usage_events;
DROP POLICY IF EXISTS "anon_delete_usage_events" ON usage_events;

DROP POLICY IF EXISTS "host_select_own_usage_events" ON usage_events;
CREATE POLICY "host_select_own_usage_events" ON usage_events FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (restaurant_id IS NOT NULL AND public.owns_restaurant(restaurant_id))
);

DROP POLICY IF EXISTS "admin_insert_usage_events" ON usage_events;
CREATE POLICY "admin_insert_usage_events" ON usage_events FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_usage_events" ON usage_events;
CREATE POLICY "admin_update_usage_events" ON usage_events FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_usage_events" ON usage_events;
CREATE POLICY "admin_delete_usage_events" ON usage_events FOR DELETE
TO authenticated
USING (public.is_admin());

-- protected-column guard
CREATE OR REPLACE FUNCTION public.guard_restaurant_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.owner_id := OLD.owner_id;
  NEW.owner_email := OLD.owner_email;
  NEW.status := OLD.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_restaurant_columns_trg ON restaurants;
CREATE TRIGGER guard_restaurant_columns_trg
BEFORE UPDATE ON restaurants
FOR EACH ROW
EXECUTE FUNCTION public.guard_restaurant_columns();
