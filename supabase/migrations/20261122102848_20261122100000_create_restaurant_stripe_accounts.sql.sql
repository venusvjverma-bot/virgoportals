/*
# Create restaurant Stripe account mapping (Connect Gateway Module 1)

1. Short descriptive title
   Restaurant ↔ Stripe connected account mapping for the Host Connect Gateway.

2. Plain-English explanation
   Each restaurant (host) will get its own Stripe Connect Accounts V2 "recipient"
   connected account. This migration creates the single table that stores that
   association, plus a snapshot of the account's onboarding/payment status so the
   Host Dashboard can display the connection state without calling Stripe.
   It does NOT create any Stripe accounts, API calls, or webhooks — those are
   later modules.

3. New tables
   - `restaurant_stripe_accounts`
     - `id` (uuid, primary key, default gen_random_uuid())
     - `restaurant_id` (uuid, NOT NULL, unique — exactly one Stripe account per
       restaurant; foreign key to `restaurants` with ON DELETE CASCADE)
     - `stripe_account_id` (text, NOT NULL, unique — one Stripe account can never
       be shared between two restaurants; stores the Accounts V2 "acct_..." id)
     - `onboarding_status` (text, NOT NULL, default 'not_connected') — status
       snapshot: not_connected / setup_required / pending_verification /
       connected / action_required
     - `charges_enabled` (boolean, nullable — unknown until Stripe reports it)
     - `payouts_enabled` (boolean, nullable — unknown until Stripe reports it)
     - `requirements` (jsonb, nullable) — relevant Stripe verification
       requirements snapshot
     - `disabled_reason` (text, nullable) — Stripe's reason when capabilities
       are restricted
     - `created_at` (timestamptz, NOT NULL, default now())
     - `updated_at` (timestamptz, NOT NULL, default now(), kept current by a
       trigger)

4. Modified tables
   - None. Existing subscription, credit top-up and payment tables are untouched.

5. Security changes
   - RLS enabled on `restaurant_stripe_accounts`.
   - Hosts (authenticated) can SELECT only their own restaurant's row, checked
     with the existing `owns_restaurant(uuid)` helper.
   - Hosts CANNOT insert, update or delete mapping rows — no such policies are
     created, so those verbs are denied by RLS by default.
   - Only the service role (trusted edge functions) writes rows. It needs an
     explicit INSERT grant because service-role writes still require grants.
   - Grants: SELECT to authenticated; SELECT + INSERT + UPDATE to service_role.
   - The RLS helper functions are SECURITY DEFINER with a fixed search_path,
     following the project convention, and are revoked from PUBLIC/anon.

6. Important notes
   - The unique constraints on `restaurant_id` and `stripe_account_id` enforce
     the one-to-one restaurant↔account relationship at the database level.
   - A trigger keeps `updated_at` current on every update.
*/

CREATE TABLE IF NOT EXISTS public.restaurant_stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  onboarding_status text NOT NULL DEFAULT 'not_connected',
  charges_enabled boolean,
  payouts_enabled boolean,
  requirements jsonb,
  disabled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current automatically.
CREATE OR REPLACE FUNCTION public.restaurant_stripe_accounts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurant_stripe_accounts_updated_at ON public.restaurant_stripe_accounts;
CREATE TRIGGER restaurant_stripe_accounts_updated_at
BEFORE UPDATE ON public.restaurant_stripe_accounts
FOR EACH ROW
EXECUTE FUNCTION public.restaurant_stripe_accounts_set_updated_at();

-- Indexes (UNIQUE constraints already create backing unique indexes for
-- restaurant_id and stripe_account_id; no extra indexes required).

-- ── RLS ──

ALTER TABLE public.restaurant_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Hosts may read only their own restaurant's mapping.
DROP POLICY IF EXISTS "host_select_own_stripe_account" ON public.restaurant_stripe_accounts;
CREATE POLICY "host_select_own_stripe_account"
ON public.restaurant_stripe_accounts FOR SELECT
TO authenticated
USING (public.owns_restaurant(restaurant_id));

-- No INSERT/UPDATE/DELETE policies are created for hosts: those verbs remain
-- denied for authenticated/anon. Only the service role writes.

-- ── Grants (project convention: explicit grants per role) ──

REVOKE ALL ON public.restaurant_stripe_accounts FROM PUBLIC, anon;

GRANT SELECT ON public.restaurant_stripe_accounts TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.restaurant_stripe_accounts TO service_role;
