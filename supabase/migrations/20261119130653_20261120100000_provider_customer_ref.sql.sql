-- Option A (Stripe-managed renewals): provider_subscription_ref now holds the
-- Stripe SUBSCRIPTION id; the customer id moves to provider_customer_ref.

ALTER TABLE public.host_subscriptions
  ADD COLUMN IF NOT EXISTS provider_customer_ref text;

-- Backfill: rows whose ref is a Stripe customer id (cus_...) keep it as the
-- customer ref until the migration step swaps in the real subscription id.
UPDATE public.host_subscriptions
SET provider_customer_ref = provider_subscription_ref
WHERE provider = 'stripe'
  AND provider_customer_ref IS NULL
  AND provider_subscription_ref LIKE 'cus_%';

CREATE UNIQUE INDEX IF NOT EXISTS host_subscriptions_stripe_sub_ref_uq
  ON public.host_subscriptions (provider_subscription_ref)
  WHERE provider = 'stripe' AND provider_subscription_ref LIKE 'sub_%';

GRANT SELECT, UPDATE ON public.host_subscriptions TO service_role;
