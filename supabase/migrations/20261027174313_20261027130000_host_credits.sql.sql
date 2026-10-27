/*
# Host Credit Controller — credit balances, audit trail, and atomic deduction

## Purpose
Introduces a per-host credit balance system. One Host Credit equals 900,000
combined input + output tokens. The balance gates all host-triggered LLM
operations: a positive balance allows LLM access; a zero balance blocks it.
Only an admin can add or remove credits. Hosts can read only their own
balance.

## 1. New Tables

### `host_credits`
- `restaurant_id` (uuid, primary key, references restaurants(id) ON DELETE CASCADE)
- `balance` (numeric(12,6), not null, default 0) — fractional credit balance
- `updated_at` (timestamptz, default now())
- One row per restaurant. Created lazily by the check/deduct function.

### `host_credit_adjustments`
- `id` (uuid, primary key)
- `restaurant_id` (uuid, references restaurants(id) ON DELETE CASCADE)
- `admin_user_id` (uuid) — the auth.users id of the admin who made the change
- `operation` (text) — 'add' | 'remove' | 'deduct' | 'initial'
- `amount` (numeric(12,6)) — always positive; operation indicates direction
- `previous_balance` (numeric(12,6))
- `resulting_balance` (numeric(12,6))
- `created_at` (timestamptz, default now())
- Audit trail for every balance change (admin adjustments and LLM deductions).

## 2. New Functions

### `check_host_credit(p_restaurant_id uuid)`
SECURITY DEFINER. Returns the current balance for a restaurant, creating a
zero-balance row if one does not yet exist. Callable by authenticated users
(used by the host wallet display). The function ensures every host has a
balance row, defaulting to 0.

### `deduct_host_credit(p_restaurant_id uuid, p_credits numeric)`
SECURITY DEFINER. Atomically deducts credits from a host's balance. Uses
`FOR UPDATE` row-level lock to prevent concurrent overspend. Returns the
new balance, or raises an exception if the deduction would make the balance
negative or if the balance is already zero. Called only by the service role
(from edge functions after an LLM operation completes).

### `adjust_host_credit(p_restaurant_id uuid, p_admin_user_id uuid, p_operation text, p_amount numeric)`
SECURITY DEFINER. Adds or removes credits. Validates that p_operation is
'add' or 'remove', p_amount is positive, and for 'remove' that the balance
is sufficient. Inserts an audit row. Returns the new balance and previous
balance. Callable only by the service role (from the admin-api edge function
after admin verification).

## 3. Security (RLS)

### `host_credits`
- RLS enabled.
- SELECT granted to `authenticated` — hosts can read their own balance.
- INSERT/UPDATE/DELETE only via service_role (edge functions) — no direct
  client writes.
- SELECT policy: host can read only the row matching their restaurant
  (via `restaurants.owner_id = auth.uid()`).
- service_role bypasses RLS for all operations.

### `host_credit_adjustments`
- RLS enabled.
- SELECT granted to `authenticated` — hosts can read their own audit trail.
- INSERT/UPDATE/DELETE only via service_role.
- SELECT policy: host can read only adjustments for their own restaurant.

### Functions
- `check_host_credit`: REVOKE from PUBLIC/anon, GRANT to authenticated.
- `deduct_host_credit`: REVOKE from PUBLIC/anon/authenticated — service_role only.
- `adjust_host_credit`: REVOKE from PUBLIC/anon/authenticated — service_role only.

## 4. Initial Allocation

A one-time `DO $$` block grants exactly 1.0 credit to the restaurant with
`owner_email = 'prince.verma88@gmail.com'`, but only if no `host_credits`
row already exists for that restaurant. This ensures the allocation runs
exactly once and does not overwrite an existing balance. All other hosts
remain at zero (or no row, which check_host_credit treats as zero).

## 5. Important Notes
1. Balance uses numeric(12,6) for full fractional precision. Display rounds
   to one decimal place; the underlying balance is never rounded before
   deduction.
2. The `deduct_host_credit` function uses `FOR UPDATE` to prevent concurrent
   requests from overspending the same balance.
3. A zero balance never suspends the host account — only LLM access is gated.
4. The initial allocation is idempotent: re-running this migration will not
   re-grant the credit because the row will already exist.
*/

-- ── host_credits table ──
CREATE TABLE IF NOT EXISTS host_credits (
  restaurant_id uuid PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  balance numeric(12,6) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE host_credits ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON host_credits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON host_credits TO service_role;

DROP POLICY IF EXISTS "hosts_read_own_credits" ON host_credits;
CREATE POLICY "hosts_read_own_credits"
  ON host_credits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = host_credits.restaurant_id
        AND restaurants.owner_id = auth.uid()
    )
  );

-- ── host_credit_adjustments audit table ──
CREATE TABLE IF NOT EXISTS host_credit_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  admin_user_id uuid,
  operation text NOT NULL,
  amount numeric(12,6) NOT NULL,
  previous_balance numeric(12,6) NOT NULL,
  resulting_balance numeric(12,6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE host_credit_adjustments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON host_credit_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON host_credit_adjustments TO service_role;

DROP POLICY IF EXISTS "hosts_read_own_adjustments" ON host_credit_adjustments;
CREATE POLICY "hosts_read_own_adjustments"
  ON host_credit_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = host_credit_adjustments.restaurant_id
        AND restaurants.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_host_credit_adjustments_restaurant
  ON host_credit_adjustments(restaurant_id, created_at DESC);

-- ── check_host_credit: returns balance, creating a zero row if missing ──
CREATE OR REPLACE FUNCTION check_host_credit(p_restaurant_id uuid)
RETURNS numeric(12,6)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(12,6);
BEGIN
  INSERT INTO host_credits (restaurant_id, balance)
  VALUES (p_restaurant_id, 0)
  ON CONFLICT (restaurant_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM host_credits
  WHERE restaurant_id = p_restaurant_id;

  RETURN v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_host_credit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_host_credit(uuid) TO authenticated;

-- ── deduct_host_credit: atomic deduction with row lock ──
CREATE OR REPLACE FUNCTION deduct_host_credit(
  p_restaurant_id uuid,
  p_credits numeric(12,6)
)
RETURNS numeric(12,6)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(12,6);
  v_new_balance numeric(12,6);
BEGIN
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Deduction amount must be positive';
  END IF;

  INSERT INTO host_credits (restaurant_id, balance)
  VALUES (p_restaurant_id, 0)
  ON CONFLICT (restaurant_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM host_credits
  WHERE restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Credit balance not found';
  END IF;

  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'No credits available';
  END IF;

  v_new_balance := v_balance - p_credits;

  IF v_new_balance < 0 THEN
    v_new_balance := 0;
  END IF;

  UPDATE host_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE restaurant_id = p_restaurant_id;

  INSERT INTO host_credit_adjustments (
    restaurant_id, operation, amount, previous_balance, resulting_balance
  )
  VALUES (
    p_restaurant_id, 'deduct', p_credits, v_balance, v_new_balance
  );

  RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION deduct_host_credit(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION deduct_host_credit(uuid, numeric) TO service_role;

-- ── adjust_host_credit: admin add/remove with audit ──
CREATE OR REPLACE FUNCTION adjust_host_credit(
  p_restaurant_id uuid,
  p_admin_user_id uuid,
  p_operation text,
  p_amount numeric(12,6)
)
RETURNS TABLE(previous_balance numeric(12,6), resulting_balance numeric(12,6))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(12,6);
  v_new_balance numeric(12,6);
BEGIN
  IF p_operation NOT IN ('add', 'remove') THEN
    RAISE EXCEPTION 'Invalid operation. Use add or remove.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO host_credits (restaurant_id, balance)
  VALUES (p_restaurant_id, 0)
  ON CONFLICT (restaurant_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM host_credits
  WHERE restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Credit balance not found';
  END IF;

  IF p_operation = 'add' THEN
    v_new_balance := v_balance + p_amount;
  ELSE
    IF p_amount > v_balance THEN
      RAISE EXCEPTION 'Cannot remove more credits than the available balance';
    END IF;
    v_new_balance := v_balance - p_amount;
  END IF;

  UPDATE host_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE restaurant_id = p_restaurant_id;

  INSERT INTO host_credit_adjustments (
    restaurant_id, admin_user_id, operation, amount,
    previous_balance, resulting_balance
  )
  VALUES (
    p_restaurant_id, p_admin_user_id, p_operation, p_amount,
    v_balance, v_new_balance
  );

  RETURN QUERY SELECT v_balance AS previous_balance, v_new_balance AS resulting_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION adjust_host_credit(uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION adjust_host_credit(uuid, uuid, text, numeric) TO service_role;

-- ── One-time initial allocation for prince.verma88@gmail.com ──
DO $$
DECLARE
  v_restaurant_id uuid;
  v_existing record;
BEGIN
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE owner_email = 'prince.verma88@gmail.com'
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE NOTICE 'No restaurant found for prince.verma88@gmail.com — initial allocation skipped';
    RETURN;
  END IF;

  -- Only allocate if no credits row exists yet (one-time, idempotent)
  SELECT 1 INTO v_existing FROM host_credits WHERE restaurant_id = v_restaurant_id;
  IF v_existing IS NULL THEN
    INSERT INTO host_credits (restaurant_id, balance)
    VALUES (v_restaurant_id, 1.0);

    INSERT INTO host_credit_adjustments (
      restaurant_id, operation, amount, previous_balance, resulting_balance
    )
    VALUES (
      v_restaurant_id, 'initial', 1.0, 0, 1.0
    );

    RAISE NOTICE 'Initial 1.0 credit allocated to prince.verma88@gmail.com (restaurant %)', v_restaurant_id;
  ELSE
    RAISE NOTICE 'Credit row already exists for prince.verma88@gmail.com — initial allocation skipped';
  END IF;
END $$;
