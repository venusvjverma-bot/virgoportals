/*
# Server-side accessor for the renewal scheduler secret

## Purpose
The subscription-api edge function needs SCHEDULED_RENEWAL_SECRET to
authenticate the pg_cron scheduler, but the value lives in Supabase Vault
(the vault schema is not exposed through the Data API). This SECURITY
DEFINER function reads it directly from vault.decrypted_secrets.

1. New Functions
- `get_renewal_scheduler_secret()` returns text: the decrypted
  'renewal_scheduler_secret' vault entry, or NULL if absent.
2. Security
- SECURITY DEFINER, stable search_path.
- EXECUTE revoked from PUBLIC/anon/authenticated; granted to service_role
  only. The secret never reaches the frontend.
*/

CREATE OR REPLACE FUNCTION public.get_renewal_scheduler_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
STABLE
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = 'renewal_scheduler_secret'
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_renewal_scheduler_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_renewal_scheduler_secret() TO service_role;
