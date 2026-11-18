/*
# Server-side accessor for the Stripe price sync secret

## Purpose
Protects the subscription-api edge function's one-time sync-stripe-prices
route. The secret lives in Supabase Vault so the operator can rotate it
without redeploying.

1. New Functions
- `get_stripe_price_sync_secret()` returns text: the decrypted
  'stripe_price_sync_secret' vault entry, or NULL if absent.
2. Security
- SECURITY DEFINER; EXECUTE revoked from PUBLIC/anon/authenticated and
  granted to service_role only.
*/

CREATE OR REPLACE FUNCTION public.get_stripe_price_sync_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
STABLE
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = 'stripe_price_sync_secret'
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_stripe_price_sync_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stripe_price_sync_secret() TO service_role;
