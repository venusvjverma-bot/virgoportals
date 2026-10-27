/*
# Virgo Portals — fix protected-column guard to run as the caller

## Overview
The `guard_restaurant_columns` trigger was declared `SECURITY DEFINER`. Inside a
definer function `current_user` is the function owner (postgres), so the check
`current_user IN ('service_role','postgres',...)` was always true and the trigger
returned every row unchanged — it guarded nothing. Row level security still
rejected the attempted ownership change, so no exposure occurred, but the
defence-in-depth layer was inert.

## Change
- Recreate `public.guard_restaurant_columns` as `SECURITY INVOKER` (the default),
  so `current_user` is the real caller: `authenticated` for a host, `service_role`
  for the edge functions, `postgres` for dashboard SQL.
- The admin path still uses `public.is_admin()` (itself `SECURITY DEFINER`, so it
  can read the allowlist).

## Effect
- A host updating their own restaurant can no longer change `owner_id`,
  `owner_email` or `status`; those are silently restored to their previous values.
- Admin and service-role updates are unaffected.

Idempotent: `CREATE OR REPLACE` plus a `DROP TRIGGER IF EXISTS` before recreate.
*/

CREATE OR REPLACE FUNCTION public.guard_restaurant_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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
