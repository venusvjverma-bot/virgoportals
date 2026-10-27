/*
# Virgo Portals — Supabase Auth foundation

## Overview
Introduces the server-side authorization primitives the Supabase Auth migration
needs: an authenticated owner link on `restaurants`, a server-side admin
allowlist, a deliberately restricted public read path for the visitor page, and
a durable server-side rate-limit counter. This migration is additive only —
no existing column, row, table or policy is dropped or retyped.

## 1. Modified table: `restaurants`
- `owner_id` (uuid, nullable) — references `auth.users(id)`. This becomes the
  real ownership key. It is nullable so the migration is safe to run before the
  accounts exist; it is backfilled from `owner_email` further down and the RLS
  rewrite in the next migration requires it for host access.
- `owner_email` is kept as-is (it is still the human-readable label and is not
  removed, to avoid any data loss).

## 2. New table: `admin_users` (private)
The authoritative admin allowlist. A user is an admin only if their
`auth.users.id` appears here.
- `user_id` (uuid, primary key) — references `auth.users(id)`.
- `email` (text) — the admin's email, for readability only.
- `created_at` (timestamptz)
Security: RLS enabled, no policies, all privileges revoked from `anon` and
`authenticated`. Only the service role (edge functions) can read it. This is the
"secure server-side role" the admin checks against — it can never be set from
the browser and is not part of the user-editable metadata.

## 3. New table: `rate_limit_counters` (private)
Durable server-side counters for abuse protection on the public visitor chat.
- `key` (text, primary key) — e.g. `chat:<ip>` or `chat:<restaurant>`.
- `window_start` (timestamptz) — start of the current fixed window.
- `count` (integer) — requests seen in the current window.
Security: RLS enabled, no policies, revoked from `anon`/`authenticated`; only the
service role and the rate-limit function below touch it.

## 4. New function: `consume_rate_limit` (SECURITY DEFINER, service_role only)
Atomically increments a counter and reports whether the caller is still within
the limit. `EXECUTE` is revoked from `PUBLIC`, `anon` and `authenticated` and
granted only to `service_role`, so no browser can call it. An explicit
`search_path` is set so the definer body cannot be hijacked.

## 5. New function: `get_public_portal` (SECURITY DEFINER, anon-callable)
The visitor page needs a restaurant's name, city and welcome greeting, but must
never see `system_prompt`, `owner_email`, `owner_id` or other private columns.
Rather than grant `anon` direct access to the `restaurants` table, this function
returns ONLY the four public fields and only for an `Active` restaurant. This is
the deliberately restricted public data path.
- Returns: id, name, city, welcome.
- `search_path` pinned; only the allowlisted columns are selected.
- Only `Active` rows are returned, so a blocked host's portal stops serving.

## 6. Notes
- Safe to re-run: `IF NOT EXISTS` on all tables/columns, `CREATE OR REPLACE` on
  both functions, and the backfill is idempotent.
- No data is deleted. `owner_id` is populated from `owner_email` where an
  `auth.users` row with that email already exists.
*/

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS restaurants_owner_id_idx ON restaurants (owner_id);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_users FROM anon, authenticated;
GRANT ALL ON admin_users TO service_role;

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);

ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limit_counters FROM anon, authenticated;
GRANT ALL ON rate_limit_counters TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit_counters (key, window_start, count)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
          WHEN public.rate_limit_counters.window_start < v_now - make_interval(secs => p_window_seconds)
            THEN 1
          ELSE public.rate_limit_counters.count + 1
        END,
        window_start = CASE
          WHEN public.rate_limit_counters.window_start < v_now - make_interval(secs => p_window_seconds)
            THEN v_now
          ELSE public.rate_limit_counters.window_start
        END
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_portal(p_portal_id uuid)
RETURNS TABLE (id uuid, name text, city text, welcome text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.city, r.welcome
  FROM public.restaurants r
  WHERE r.id = p_portal_id
    AND r.status = 'Active';
$$;

REVOKE ALL ON FUNCTION public.get_public_portal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_portal(uuid) TO anon, authenticated;

UPDATE restaurants r
SET owner_id = u.id
FROM auth.users u
WHERE r.owner_id IS NULL
  AND lower(r.owner_email) = lower(u.email);
