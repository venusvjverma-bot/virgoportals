/*
# SEK subscription pricing

## 1. Purpose
Switch the Host Subscription system from US dollars to Swedish kronor. Virgo
Portal currently operates only in Sweden, so all subscription prices and all
subscription billing are now in SEK. No multi-currency support, no country
detection, no reverse-charge handling.

## 2. Price changes (subscription_packages only)
Prices are stored in hundredths (minor units) and are EXCLUDING VAT:
- starter:  $49.90  ->  500 SEK   (4990 -> 50000)
- growth:   $97.90  ->  1,000 SEK (9790 -> 100000)
- business: $159.90 ->  1,600 SEK (15990 -> 160000)

## 3. Currency handling
- `subscription_payments.currency` default changed from 'USD' to 'SEK'.
- `allocate_subscription_credits` now records 'SEK' for a successful cycle.
- `process_subscription_renewal` now reserves the next cycle in 'SEK'.
Both routines are otherwise unchanged (same signature, SECURITY DEFINER,
pinned search_path, same idempotency and credit-allocation behaviour).

## 4. Historical data — deliberately untouched
Existing `subscription_payments` rows keep their original 'USD' value. They are
a record of what was actually charged at the time. No historical row is updated.

## 5. Explicitly out of scope
- Credit top-up packages and their pricing (still USD).
- Credit quantities / conversion.
- The payment provider setup (no real provider is connected).
- The renewal charge amount (still zero in the service layer).

## 6. Notes
1. Top-up tables (`credit_topup_payments`, `credit_topup_packages`) are NOT
   modified by this migration.
2. Safe to re-run: price updates are idempotent by package code, the default
   change is idempotent, and both functions use CREATE OR REPLACE.
3. VAT (25% Swedish) is added at display/checkout time, not stored here.
*/

-- ── 1. Subscription package prices → SEK (hundredths, excluding VAT) ──
UPDATE subscription_packages SET price_cents = 50000  WHERE code = 'starter';
UPDATE subscription_packages SET price_cents = 100000 WHERE code = 'growth';
UPDATE subscription_packages SET price_cents = 160000 WHERE code = 'business';

-- ── 2. New subscription payment rows default to SEK ──
ALTER TABLE subscription_payments ALTER COLUMN currency SET DEFAULT 'SEK';

-- ── 3. allocate_subscription_credits: record SEK (unchanged otherwise) ──
CREATE OR REPLACE FUNCTION allocate_subscription_credits(
  p_restaurant_id uuid,
  p_package_id uuid,
  p_cycle_number integer,
  p_provider_payment_ref text
)
RETURNS TABLE(allocated boolean, new_balance numeric(12,6), period_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription host_subscriptions;
  v_package subscription_packages;
  v_existing subscription_payments;
  v_balance numeric(12,6);
  v_new_balance numeric(12,6);
  v_new_period_end timestamptz;
  v_target_year integer;
  v_target_month integer;
  v_last_day integer;
BEGIN
  IF p_cycle_number < 1 THEN
    RAISE EXCEPTION 'Cycle number must be positive';
  END IF;

  SELECT * INTO v_subscription FROM host_subscriptions
    WHERE restaurant_id = p_restaurant_id FOR UPDATE;
  IF v_subscription.id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  SELECT * INTO v_package FROM subscription_packages WHERE id = p_package_id;
  IF v_package.id IS NULL THEN
    RAISE EXCEPTION 'Package not found';
  END IF;

  -- Idempotency: the payment row is the single source of truth for "this
  -- cycle was paid". If it already exists, the webhook was replayed.
  SELECT * INTO v_existing FROM subscription_payments
    WHERE subscription_id = v_subscription.id
      AND cycle_number = p_cycle_number;
  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY SELECT false, (SELECT balance FROM host_credits WHERE restaurant_id = p_restaurant_id), v_subscription.period_end;
    RETURN;
  END IF;

  INSERT INTO subscription_payments (
    subscription_id, package_id, cycle_number, amount_cents, currency,
    status, provider, provider_payment_ref, paid_at
  ) VALUES (
    v_subscription.id, p_package_id, p_cycle_number, v_package.price_cents, 'SEK',
    'succeeded', v_subscription.provider, p_provider_payment_ref, now()
  );

  -- Add to the existing wallet (never reset). Creates a zero row if missing.
  INSERT INTO host_credits (restaurant_id, balance)
  VALUES (p_restaurant_id, 0)
  ON CONFLICT (restaurant_id) DO NOTHING;

  SELECT balance INTO v_balance FROM host_credits
    WHERE restaurant_id = p_restaurant_id FOR UPDATE;

  v_new_balance := v_balance + v_package.credits;

  UPDATE host_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE restaurant_id = p_restaurant_id;

  INSERT INTO host_credit_adjustments (
    restaurant_id, operation, amount, previous_balance, resulting_balance
  )
  VALUES (
    p_restaurant_id, 'subscription', v_package.credits, v_balance, v_new_balance
  );

  -- Advance the period by one month from the anchor, clamped to month end
  -- (e.g. anchor 31 Jan → 28/29 Feb → 31 Mar). No drift.
  v_target_year := EXTRACT(YEAR FROM now());
  v_target_month := EXTRACT(MONTH FROM now()) + 1;
  IF v_target_month > 12 THEN
    v_target_month := 1;
    v_target_year := v_target_year + 1;
  END IF;
  v_last_day := EXTRACT(DAY FROM
    (date_trunc('month', make_date(v_target_year, v_target_month, 1)) + interval '1 month - 1 day')::date);
  v_new_period_end := make_timestamptz(
    v_target_year, v_target_month, LEAST(v_subscription.billing_anchor_day, v_last_day),
    EXTRACT(HOUR FROM v_subscription.period_end)::int, 0, 0, 'UTC'
  );

  UPDATE host_subscriptions
  SET period_start = v_subscription.period_end,
      period_end = v_new_period_end,
      package_id = coalesce(scheduled_package_id, package_id),
      scheduled_package_id = NULL,
      status = 'active',
      updated_at = now()
  WHERE id = v_subscription.id;

  RETURN QUERY SELECT true, v_new_balance, v_new_period_end;
END;
$$;

REVOKE EXECUTE ON FUNCTION allocate_subscription_credits(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION allocate_subscription_credits(uuid, uuid, integer, text) TO service_role;

-- ── 4. process_subscription_renewal: reserve the next cycle in SEK ──
CREATE OR REPLACE FUNCTION process_subscription_renewal(p_subscription_id uuid)
RETURNS TABLE(reserved boolean, cycle_number integer, package_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub host_subscriptions;
  v_next_cycle integer;
  v_pkg subscription_packages;
BEGIN
  SELECT * INTO v_sub FROM host_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF v_sub.status <> 'active' OR v_sub.auto_renew = false OR v_sub.cancel_at_period_end = true THEN
    RETURN QUERY SELECT false, 0::integer, '';
    RETURN;
  END IF;

  SELECT coalesce(MAX(cycle_number), 0) + 1 INTO v_next_cycle
    FROM subscription_payments WHERE subscription_id = v_sub.id;

  IF EXISTS (
    SELECT 1 FROM subscription_payments
    WHERE subscription_id = v_sub.id AND cycle_number = v_next_cycle
  ) THEN
    RETURN QUERY SELECT false, v_next_cycle, '';
    RETURN;
  END IF;

  SELECT * INTO v_pkg FROM subscription_packages
    WHERE id = coalesce(v_sub.scheduled_package_id, v_sub.package_id);

  INSERT INTO subscription_payments (
    subscription_id, package_id, cycle_number, amount_cents, currency, status, provider
  ) VALUES (
    v_sub.id, v_pkg.id, v_next_cycle, v_pkg.price_cents, 'SEK', 'pending', v_sub.provider
  );

  RETURN QUERY SELECT true, v_next_cycle, v_pkg.code;
END;
$$;

REVOKE EXECUTE ON FUNCTION process_subscription_renewal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_subscription_renewal(uuid) TO service_role;
