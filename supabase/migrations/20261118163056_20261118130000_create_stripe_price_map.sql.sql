/*
# Stripe price mapping table

## Purpose
Maps each existing subscription package and credit top-up package to its
Stripe Price object. Prices themselves live in Stripe; this table is the
single lookup the checkout routes use (stripe_price_map.package_code +
kind -> stripe_price_id).

1. New Tables
- `stripe_price_map`: package_code (text, matches subscription_packages.code
  or credit_topup_packages.code), kind ('subscription' | 'topup'),
  stripe_product_id, stripe_price_id, price_cents, currency.
2. Security
- RLS enabled; no policies for anon/authenticated (server-only via
  service_role, which bypasses RLS). Hosts never read this table directly —
  checkout routes resolve price ids server-side.
*/

CREATE TABLE IF NOT EXISTS public.stripe_price_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('subscription', 'topup')),
  stripe_product_id text NOT NULL,
  stripe_price_id text NOT NULL,
  price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'SEK',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_code, kind)
);

ALTER TABLE public.stripe_price_map ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_price_map TO service_role;
