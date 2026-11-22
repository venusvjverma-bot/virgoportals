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
     - `onboarding_status` (text, NOT NULL, default 'not_connected'; CHECK limits
       it to: not_connected / setup_required / pending_verification / connected /
       action_required)
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
     with the existing `owns_restaurant(uuid)` helper (admins also pass via the
     helper, matching project convention).
   - Hosts CANNOT insert, update or delete mapping rows: no write policies are
     created (RLS denies those verbs) AND the write privileges are explicitly
     revoked from authenticated so the grant level also blocks them.
   - Only the service role (trusted edge functions) writes rows: it receives
     SELECT + INSERT + UPDATE grants (RLS does not apply to service_role).
   - The updated_at trigger function is SECURITY DEFINER with a fixed
     search_path, and EXECUTE is revoked from PUBLIC/anon per project convention.

6. Important notes
   - The unique constraints on `restaurant_id` and `stripe_account_id` enforce
     the one-to-one restaurant↔account relationship at the database level.
   - Safe to re-run: idempotent DDL, drop-first policy, DO-block constraint add.
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_stripe_accounts_status_check'
      AND conrelid = 'public.restaurant_stripe_accounts'::regclass
  ) THEN
    ALTER TABLE public.restaurant_stripe_accounts
      ADD CONSTRAINT restaurant_stripe_accounts_status_check
      CHECK (onboarding_status IN (
        'not_connected', 'setup_required', 'pending_verification',
        'connected', 'action_required'
      ));
  END IF;
END;
$$;

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

REVOKE EXECUTE ON FUNCTION public.restaurant_stripe_accounts_set_updated_at()
  FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS restaurant_stripe_accounts_updated_at ON public.restaurant_stripe_accounts;
CREATE TRIGGER restaurant_stripe_accounts_updated_at
BEFORE UPDATE ON public.restaurant_stripe_accounts
FOR EACH ROW
EXECUTE FUNCTION public.restaurant_stripe_accounts_set_updated_at();

-- Unique backing indexes for the one-to-one mapping (explicit for clarity).
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_stripe_accounts_restaurant_id_key
  ON public.restaurant_stripe_accounts (restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_stripe_accounts_stripe_account_id_key
  ON public.restaurant_stripe_accounts (stripe_account_id);

-- ── RLS ──

ALTER TABLE public.restaurant_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Hosts may read only their own restaurant's mapping.
DROP POLICY IF EXISTS "host_select_own_stripe_account" ON public.restaurant_stripe_accounts;
CREATE POLICY "host_select_own_stripe_account"
ON public.restaurant_stripe_accounts FOR SELECT
TO authenticated
USING (public.owns_restaurant(restaurant_id));

-- No INSERT/UPDATE/DELETE policies exist, so RLS denies those verbs for
-- hosts. Revoke them explicitly as well (project default privileges grant
-- all verbs to authenticated on new tables).

REVOKE ALL ON public.restaurant_stripe_accounts FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.restaurant_stripe_accounts FROM anon, authenticated;

GRANT SELECT ON public.restaurant_stripe_accounts TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.restaurant_stripe_accounts TO service_role;
