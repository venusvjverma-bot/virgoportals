/*
# Update top-up package prices to SEK

1. Purpose
- The Virgo Portal has moved its billing to Swedish kronor (SEK) and prices
  are quoted excluding VAT. This migration brings the credit top-up packages
  in line with the subscription packages that were already converted.

2. Modified data — `credit_topup_packages`
- `price_cents` updated to the agreed SEK prices, expressed in hundredths
  (minor units) exactly like the subscription packages:
  - Mini   : 400    -> 5,000   (50.00 SEK, excl. VAT)
  - Small  : 900    -> 11,000  (110.00 SEK, excl. VAT)
  - Medium : 1,700  -> 20,000  (200.00 SEK, excl. VAT)
  - Large  : 3,400  -> 40,000  (400.00 SEK, excl. VAT)
- Credit quantities (20 / 50 / 100 / 200), package names and sort order are
  NOT changed.
- Rows are updated by `code` (a stable value), never by id, so the migration
  is safe to re-run and safe on a freshly rebuilt database.
- The amounts stored remain the EXCLUDING-VAT price, matching the subscription
  packages. Swedish VAT of 25% is added at the presentation/checkout layer
  (50 + 12.50 VAT = 62.50 SEK total, etc.).

3. Modified table — `credit_topup_payments`
- `currency` column DEFAULT changed from 'USD' to 'SEK' so newly recorded
  top-up payments are denominated in SEK.
- Historical rows are NOT touched: existing payment records keep whatever
  currency they were recorded with, so past purchases remain unchanged.

4. Modified function — `allocate_topup_credits`
- Re-created (CREATE OR REPLACE) with only one behavioural change: the
  currency written into the new `credit_topup_payments` row is now 'SEK'
  instead of 'USD'.
- The recorded `amount_cents` is still taken from the package's stored
  `price_cents` (the excluding-VAT price), consistent with how subscription
  payments are recorded.
- Eligibility checks, idempotency by payment reference, credit allocation
  and the host_credit_adjustments audit row are all UNCHANGED. Credit
  allocation and credit conversion are deliberately untouched.
- EXECUTE privileges are unchanged: revoked from PUBLIC/anon/authenticated,
  granted to service_role only.

5. Security
- No new tables, no new columns, no RLS policy changes and no privilege
  changes. This migration only updates catalogue prices and one currency
  literal inside an already-restricted SECURITY DEFINER function.

6. Important notes
- No subscription packages, subscription payments or subscription logic are
  affected by this migration.
- No historical top-up payment record is modified or deleted.
*/

UPDATE credit_topup_packages
SET price_cents = CASE code
  WHEN 'mini'   THEN 5000
  WHEN 'small'  THEN 11000
  WHEN 'medium' THEN 20000
  WHEN 'large'  THEN 40000
  ELSE price_cents
END
WHERE code IN ('mini', 'small', 'medium', 'large');

ALTER TABLE credit_topup_payments
  ALTER COLUMN currency SET DEFAULT 'SEK';

CREATE OR REPLACE FUNCTION allocate_topup_credits(
  p_restaurant_id uuid,
  p_package_id uuid,
  p_provider text,
  p_provider_payment_ref text
)
RETURNS TABLE(allocated boolean, new_balance numeric(12,6))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub host_subscriptions;
  v_package credit_topup_packages;
  v_existing credit_topup_payments;
  v_balance numeric(12,6);
  v_new_balance numeric(12,6);
BEGIN
  -- Eligibility is enforced here, not in the UI. Requires an active paid
  -- subscription whose period has not yet ended. cancel_at_period_end is NOT
  -- treated as expired: purchasing remains available until period_end passes.
  SELECT * INTO v_sub FROM host_subscriptions
    WHERE restaurant_id = p_restaurant_id
    FOR UPDATE;
  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'An active subscription is required to purchase top-up credits.';
  END IF;
  IF v_sub.status <> 'active' THEN
    RAISE EXCEPTION 'An active subscription is required to purchase top-up credits.';
  END IF;
  IF v_sub.period_end IS NOT NULL AND v_sub.period_end <= now() THEN
    RAISE EXCEPTION 'An active subscription is required to purchase top-up credits.';
  END IF;

  SELECT * INTO v_package FROM credit_topup_packages
    WHERE id = p_package_id AND is_active = true;
  IF v_package.id IS NULL THEN
    RAISE EXCEPTION 'Top-up package not found.';
  END IF;

  IF p_provider_payment_ref IS NULL THEN
    RAISE EXCEPTION 'Payment reference is required.';
  END IF;

  -- Idempotency: the payment reference is the source of truth. If it was
  -- already recorded (replay/duplicate), allocate nothing.
  SELECT * INTO v_existing FROM credit_topup_payments
    WHERE provider_payment_ref = p_provider_payment_ref;
  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY SELECT false,
      COALESCE((SELECT balance FROM host_credits WHERE restaurant_id = p_restaurant_id), 0);
    RETURN;
  END IF;

  INSERT INTO credit_topup_payments (
    restaurant_id, package_id, credits, amount_cents, currency,
    status, provider, provider_payment_ref, paid_at
  ) VALUES (
    p_restaurant_id, p_package_id, v_package.credits, v_package.price_cents, 'SEK',
    'succeeded', p_provider, p_provider_payment_ref, now()
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
    p_restaurant_id, 'topup', v_package.credits, v_balance, v_new_balance
  );

  RETURN QUERY SELECT true, v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION allocate_topup_credits(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION allocate_topup_credits(uuid, uuid, text, text) TO service_role;
