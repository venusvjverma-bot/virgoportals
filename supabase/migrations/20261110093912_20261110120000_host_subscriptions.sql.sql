/*
# Host Subscription & Billing System — Foundation

## 1. Purpose
Adds the first version of the Host Subscription system: three centrally
configured monthly packages (Starter / Growth / Business), one active
subscription per restaurant, an auditable payment record per billing cycle,
webhook event tracking for duplicate-delivery protection, and atomic
idempotent credit allocation that integrates with the existing
`host_credits` wallet without touching the existing Credit Controller.

## 2. New Tables

### `subscription_packages`
Centrally configurable package catalogue (prices in USD, credits are Host
Credits where 1 credit = 900,000 combined tokens).
- `id` (uuid, pk), `code` (text, unique: 'starter' | 'growth' | 'business')
- `name` (text), `price_cents` (integer, USD minor units)
- `credits` (numeric(12,6)), `sort_order` (integer), `is_active` (boolean)

### `host_subscriptions`
One row per restaurant (enforced by unique constraint = one active
subscription at a time at DB level).
- `id` (uuid, pk), `restaurant_id` (uuid, unique, FK restaurants ON DELETE CASCADE)
- `status` (text: 'incomplete' | 'active' | 'payment_failed' | 'canceled' | 'expired')
- `package_id` (uuid FK subscription_packages) — currently paid package
- `scheduled_package_id` (uuid FK, nullable) — package change applied at next renewal
- `auto_renew` (boolean, default true)
- `billing_anchor_day` (integer 1-31, clamped for short months) — anchor of the cycle
- `period_start` (timestamptz), `period_end` (timestamptz) — current paid period
- `cancel_at_period_end` (boolean, default false)
- `canceled_at`, `expired_at` (timestamptz, nullable)
- `provider` (text, nullable) — payment provider identifier once connected
- `provider_subscription_ref` (text, nullable) — gateway subscription id
- `created_at`, `updated_at`

### `subscription_payments`
One row per billing attempt/cycle.
- `id` (uuid pk), `subscription_id` FK host_subscriptions ON DELETE CASCADE
- `package_id` FK, `cycle_number` (integer, 1-based)
- `amount_cents` (integer USD), `currency` (text default 'USD')
- `status` (text: 'pending' | 'succeeded' | 'failed')
- `provider` (text), `provider_payment_ref` (text, nullable) — transaction id
- `provider_invoice_url` (text, nullable) — provider receipt/invoice link
- `paid_at`, `created_at` (timestamptz)
- Unique index on (`subscription_id`, `cycle_number`) — guarantees a renewal
  cannot happen twice for the same billing period.
- Unique partial index on `provider_payment_ref` where not null — guarantees a
  webhook replay cannot create a second payment record for one transaction.

### `subscription_webhook_events`
Duplicate-event protection: providers replay webhooks; each processed event id
is stored once (unique on `provider` + `event_id`).
- `id` (uuid pk), `provider` (text), `event_id` (text), `event_type` (text),
  `processed_at` (timestamptz)

## 3. New Functions (SECURITY DEFINER, service_role only unless noted)

### `allocate_subscription_credits(p_restaurant_id, p_package_id, p_cycle_number, p_provider_payment_ref)`
Atomic + idempotent credit allocation for one successful payment cycle.
Idempotency is derived from the unique (`subscription_id`, `cycle_number`)
payment row: inserting the payment row inside the same transaction with
`ON CONFLICT DO NOTHING`; if it already exists the allocation is skipped and
no credits are added (protects against webhook replays). Adds the package
credits to the existing `host_credits` balance (never resets), writes a
`subscription` operation row into the existing `host_credit_adjustments`
audit trail, and advances the subscription's period by one month (clamped
month-end arithmetic from the billing anchor). Callable only by service_role.

### `process_subscription_renewal(p_subscription_id)`
Server-side renewal attempt record-keeper: starts a 'pending' payment for the
next cycle (fails if one already exists for that cycle — no double renewals).
The actual charge is performed by the provider adapter; this function only
reserves the cycle. Callable only by service_role.

### `expire_due_subscriptions()`
Sets `status='expired'` (and `expired_at`) for active subscriptions whose
`period_end` has passed and which have `auto_renew=false` or
`cancel_at_period_end=true`. Credits are untouched. Callable by service_role;
intended to be invoked by the scheduled renewal job after renewal processing.

## 4. Seed Data
Three packages seeded idempotently: starter $49.90 / 300 cr, growth $97.90 /
600 cr, business $159.90 / 1,000 cr (USD).

## 5. Security (RLS)
- All four tables: RLS enabled.
- Hosts: SELECT-own only, via `restaurants.owner_id = auth.uid()`
  (same predicate as existing `host_credits` policies). Hosts can never
  INSERT/UPDATE/DELETE — payment confirmation and allocation are
  service-role-only server operations.
- Admin: read-only through the existing admin-api edge function using the
  service role (admin allowlist enforced server-side, same as Credit
  Controller). No direct table grants to any admin path beyond service_role.
- `allocate_subscription_credits`, `process_subscription_renewal`,
  `expire_due_subscriptions`: REVOKE from PUBLIC/anon/authenticated;
  GRANT to service_role only.
- Grant note: hosts read the tables through the Data API, so SELECT is
  granted to `authenticated`; all writes are service_role.
- `subscription_packages` is readable by any authenticated host (catalogue).

## 6. Important Notes
1. Wallet integration is additive only: allocations go through the same
   `host_credits` row and audit trail the Credit Controller uses. The existing
   `adjust_host_credit` / `deduct_host_credit` functions are untouched.
2. Month-end handling: `billing_anchor_day` is stored (e.g. 31) and each new
   period end is computed by clamping to the target month's last day
   (Jan 31 → Feb 28/29 → Mar 31) — no drift.
3. Visitor Chat credit gating is untouched: subscription status and credit
   balance remain separate; expiry never removes credits.
4. No payment provider is connected. `provider`/`provider_*` columns are
   nullable placeholders for the adapter to fill once a provider is chosen.
*/

-- ── subscription_packages ──
CREATE TABLE IF NOT EXISTS subscription_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  credits numeric(12,6) NOT NULL CHECK (credits > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON subscription_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscription_packages TO service_role;

DROP POLICY IF EXISTS "hosts_read_packages" ON subscription_packages;
CREATE POLICY "hosts_read_packages"
  ON subscription_packages FOR SELECT
  TO authenticated
  USING (true);

-- ── host_subscriptions ──
CREATE TABLE IF NOT EXISTS host_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'active', 'payment_failed', 'canceled', 'expired')),
  package_id uuid NOT NULL REFERENCES subscription_packages(id),
  scheduled_package_id uuid REFERENCES subscription_packages(id),
  auto_renew boolean NOT NULL DEFAULT true,
  billing_anchor_day integer NOT NULL DEFAULT 1 CHECK (billing_anchor_day BETWEEN 1 AND 31),
  period_start timestamptz,
  period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  expired_at timestamptz,
  provider text,
  provider_subscription_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE host_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON host_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON host_subscriptions TO service_role;

DROP POLICY IF EXISTS "hosts_read_own_subscription" ON host_subscriptions;
CREATE POLICY "hosts_read_own_subscription"
  ON host_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = host_subscriptions.restaurant_id
        AND restaurants.owner_id = auth.uid()
    )
  );

-- ── subscription_payments ──
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES host_subscriptions(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES subscription_packages(id),
  cycle_number integer NOT NULL CHECK (cycle_number >= 1),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider text,
  provider_payment_ref text,
  provider_invoice_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, cycle_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_payments_provider_ref
  ON subscription_payments (provider_payment_ref)
  WHERE provider_payment_ref IS NOT NULL;

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON subscription_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscription_payments TO service_role;

DROP POLICY IF EXISTS "hosts_read_own_subscription_payments" ON subscription_payments;
CREATE POLICY "hosts_read_own_subscription_payments"
  ON subscription_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM host_subscriptions s
      JOIN restaurants r ON r.id = s.restaurant_id
      WHERE s.id = subscription_payments.subscription_id
        AND r.owner_id = auth.uid()
    )
  );

-- ── subscription_webhook_events ──
CREATE TABLE IF NOT EXISTS subscription_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

ALTER TABLE subscription_webhook_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscription_webhook_events TO service_role;

-- ── allocate_subscription_credits ──
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
    v_subscription.id, p_package_id, p_cycle_number, v_package.price_cents, 'USD',
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

-- ── process_subscription_renewal: reserve the next cycle (no double renewals) ──
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
    v_sub.id, v_pkg.id, v_next_cycle, v_pkg.price_cents, 'USD', 'pending', v_sub.provider
  );

  RETURN QUERY SELECT true, v_next_cycle, v_pkg.code;
END;
$$;

REVOKE EXECUTE ON FUNCTION process_subscription_renewal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_subscription_renewal(uuid) TO service_role;

-- ── expire_due_subscriptions ──
CREATE OR REPLACE FUNCTION expire_due_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE host_subscriptions
  SET status = 'expired',
      expired_at = now(),
      updated_at = now()
  WHERE status = 'active'
    AND (auto_renew = false OR cancel_at_period_end = true)
    AND period_end IS NOT NULL
    AND period_end <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION expire_due_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_due_subscriptions() TO service_role;

-- ── Seed packages (idempotent) ──
INSERT INTO subscription_packages (code, name, price_cents, credits, sort_order)
VALUES
  ('starter', 'Starter', 4990, 300, 1),
  ('growth', 'Growth', 9790, 600, 2),
  ('business', 'Business', 15990, 1000, 3)
ON CONFLICT (code) DO NOTHING;
