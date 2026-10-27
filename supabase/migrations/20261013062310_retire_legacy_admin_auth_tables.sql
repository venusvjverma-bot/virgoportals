/*
# Retire the legacy custom admin credential and session tables

## Plain English

Before this change the admin area used its own login: an email and a plaintext
password held in `admin_credentials`, and hand-made session tokens held in
`admin_sessions`. Both accounts now sign in with Supabase Auth, and admin
authorization is decided by the server-side `admin_users` allowlist, so these two
tables have no remaining purpose and are a liability — one of them stored a
password in a form that must never be stored that way.

Both tables are renamed out of the way rather than dropped, so nothing is lost
and the change can be undone.

## Changes

- `admin_credentials` renamed to `retired_admin_credentials`.
- `admin_sessions` renamed to `retired_admin_sessions`.
- Both remain row level security enabled with no policies, so they are already
  unreachable from the browser.
- All privileges are revoked from `anon` and `authenticated`.

## Important notes

1. No row is deleted. If a rollback is ever needed, renaming back restores the
   previous state exactly.
2. Verified before this change that no frontend file and no Edge Function reads
   either table — the only remaining references were in this migration.
3. The admin account's password hash was carried over into Supabase Auth during
   the earlier `migrate_users_to_supabase_auth` migration, so retiring the old
   table does not lock anybody out. Login through Supabase Auth was confirmed
   working for both the admin and the host account before this migration.
*/

ALTER TABLE IF EXISTS public.admin_credentials RENAME TO retired_admin_credentials;
ALTER TABLE IF EXISTS public.admin_sessions RENAME TO retired_admin_sessions;

ALTER TABLE IF EXISTS public.retired_admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.retired_admin_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.retired_admin_credentials FROM anon, authenticated;
REVOKE ALL ON public.retired_admin_sessions FROM anon, authenticated;

DROP POLICY IF EXISTS "admin_select_admin_credentials" ON public.retired_admin_credentials;
DROP POLICY IF EXISTS "admin_select_admin_sessions" ON public.retired_admin_sessions;
