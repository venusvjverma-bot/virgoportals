/*
# Credit Top-up — packages, payments, and atomic allocation

## 1. Purpose
Adds a Credit Top-up feature to the Host Subscription system. Hosts with an
active paid subscription can buy one of four fixed credit packages. Successfully
purchased credits are added to the existing `host_credits` wallet (no separate
wallet, no special credit type) and written to the existing
`host_credit_adjustments` audit trail with operation 'topup'.

## 2. New Tables

### `credit_topup_packages`
Centrally configured top-up catalogue (prices in USD; credits are ordinary
Host Credits where 1 credit = 900,000 combined tokens).
- `id` (uuid, pk), `code` (text, unique: 'mini' | 'small' | 'medium' | 'large')
- `name` (text), `credits` (numeric(12,6)), `price_cents` (integer USD)
- `sort_order` (integer), `is_active` (boolean), `created_at`

### `credit_topup_payments`
One row per top-up purchase attempt. Linked to the restaurant (not a
subscription cycle — top-ups are one-off).
- `id` (uuid pk), `restaurant_id` (uuid FK restaurants ON DELETE CASCADE)
- `package_id` (uuid FK credit_topup_packages)
- `credits` (numeric(12,6)) — quantity purchased (snapshot)
- `amount_cents` (integer USD), `currency` (text default 'USD')
- `status` (text: 'pending' | 'succeeded' | 'failed')
- `provider` (text), `provider_payment_ref` (text, nullable)
- `provider_invoice_url` (text, nullable), `paid_at`, `created_at`
- Unique partial index on `provider_payment_ref` where not null — guarantees a
  replayed/duplicated payment reference cannot allocate credits twice.

## 3. New Function

### `allocate_topup_credits(p_restaurant_id, p_package_id, p_provider, p_provider_payment_ref)`
SECURITY DEFINER, service_role only. Atomic + idempotent.
1. Locks the restaurant's subscription and requires `status = 'active'` AND
   `period_end > now()` (a still-active paid period). A cancellation request
   alone does not block it: purchasing stays available until the paid period
   actually ends.
2. Loads the package from the catalogue and requires `is_active = true`.
3. Idempotency: if a payment with the same `provider_payment_ref` already
   exists, returns `allocated = false` and adds nothing.
4. On success it inserts the payment row, adds `credits` to the existing
   `host_credits` balance (preserving the current balance), and writes a
   'topup' row to `host_credit_adjustments`.

## 4. Seed Data
Four packages seeded idempotently: mini 20/$4.00, small 50/$9.00,
medium 100/$17.00, large 200/$34.00 (USD).

## 5. Security (RLS)
- Both new tables: RLS enabled.
- Hosts: SELECT-own payments via `restaurants.owner_id = auth.uid()`;
  SELECT the active package catalogue (like `subscription_packages`). Hosts can
  never INSERT/UPDATE/DELETE — payment confirmation and allocation are
  service-role-only server operations.
- `allocate_topup_credits`: REVOKE from PUBLIC/anon/authenticated; GRANT to
  service_role only.

## 6. Important Notes
1. Wallet integration is additive only: allocation uses the same `host_credits`
   row and audit trail the Credit Controller and subscription allocation use.
   Existing `adjust_host_credit` / `deduct_host_credit` are untouched.
2. Subscription eligibility and credit usage remain separate: an expired
   subscription only blocks further top-up purchases; existing credits are
   never frozen, removed, or expired.
*/

-- ── credit_topup_packages ──
CREATE TABLE IF NOT EXISTS credit_topup_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  credits numeric(12,6) NOT NULL CHECK (credits > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_topup_packages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON credit_topup_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON credit_topup_packages TO service_role;

DROP POLICY IF EXISTS "hosts_read_topup_packages" ON credit_topup_packages;
CREATE POLICY "hosts_read_topup_packages"
  ON credit_topup_packages FOR SELECT
  TO authenticated
  USING (true);

-- ── credit_topup_payments ──
CREATE TABLE IF NOT EXISTS credit_topup_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES credit_topup_packages(id),
  credits numeric(12,6) NOT NULL CHECK (credits > 0),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider text,
  provider_payment_ref text,
  provider_invoice_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_topup_payments_provider_ref
  ON credit_topup_payments (provider_payment_ref)
  WHERE provider_payment_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_topup_payments_restaurant
  ON credit_topup_payments (restaurant_id, created_at DESC);

ALTER TABLE credit_topup_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON credit_topup_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON credit_topup_payments TO service_role;

DROP POLICY IF EXISTS "hosts_read_own_topup_payments" ON credit_topup_payments;
CREATE POLICY "hosts_read_own_topup_payments"
  ON credit_topup_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = credit_topup_payments.restaurant_id
        AND restaurants.owner_id = auth.uid()
    )
  );

-- ── allocate_topup_credits ──
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
    p_restaurant_id, p_package_id, v_package.credits, v_package.price_cents, 'USD',
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

-- ── Seed packages (idempotent) ──
INSERT INTO credit_topup_packages (code, name, credits, price_cents, sort_order)
VALUES
  ('mini', 'Mini', 20, 400, 1),
  ('small', 'Small', 50, 900, 2),
  ('medium', 'Medium', 100, 1700, 3),
  ('large', 'Large', 200, 3400, 4)
ON CONFLICT (code) DO NOTHING;
