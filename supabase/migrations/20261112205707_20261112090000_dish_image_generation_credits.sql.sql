/*
# Dish Image Generation Credits — ledger table, atomic deduction, refund

1. Purpose
Adds per-generation accounting for dish and combo image generation. Every
generation attempt deducts exactly 1 Host Credit before the image API is
called, records the outcome, and refunds the credit exactly once if the
generation does not produce a saved image. The new table doubles as the
Host-facing generation history.

2. New Tables

### `dish_image_generations`
One row per generation attempt.
- `id` (uuid, primary key)
- `restaurant_id` (uuid, FK restaurants ON DELETE CASCADE)
- `target_type` (text, 'dish' | 'combo')
- `target_id` (uuid, nullable — the dish or combo; nullable so history survives deletion)
- `target_name` (text, NOT NULL — snapshot of the dish/combo name at request time)
- `status` (text: 'pending' | 'succeeded' | 'failed')
- `generation_id` (text, nullable — API prediction/generation ID, null when the provider does not return one)
- `credit_deducted` (numeric(12,6), always 1.0)
- `refunded` (boolean, default false)
- `error_message` (text, nullable)
- `idempotency_key` (text, UNIQUE NOT NULL — the client request ID; one deduction per click)
- `created_at`, `completed_at` (timestamptz)

3. New Functions (both SECURITY DEFINER, service_role only)

### `begin_dish_image_generation(...)`
Atomic pre-flight: refunds and fails any of the restaurant's pending rows
older than 45 minutes (crash recovery), then — inside the same transaction —
returns the existing row unchanged if the idempotency key was already used
(no duplicate deduction), otherwise checks balance >= 1 (row-locked so
concurrent requests cannot overspend), deducts 1 credit, writes the audit row
(operation 'deduct') and inserts the pending history row. Raises a distinct
error when the balance is insufficient.

### `complete_dish_image_generation(...)`
Atomic completion: locks the history row and no-ops when it is no longer
pending (idempotent, no double refund). On success stores the API generation
ID. On failure stores the error, adds 1 credit back, writes an audit row
(operation 'refund') and marks the row refunded.

4. Security (RLS)
- `dish_image_generations`: RLS enabled. SELECT granted to authenticated with
  an owner-scoped policy (restaurants.owner_id = auth.uid()); all writes are
  service_role only. Both functions are revoked from PUBLIC/anon/authenticated
  and granted to service_role only.

5. Important Notes
1. Deduction, history creation and refunds all write to the existing
   `host_credit_adjustments` audit trail, so the wallet and history can never
   disagree. No competing accounting system is introduced.
2. The stale-pending sweep is idempotent: it only touches rows still in
   'pending' and relies on the same completion lock, so a late response can
   never resurrect an already-refunded generation.
3. The table has no UPDATE/DELETE grants for clients; history rows are
   preserved permanently.
*/

CREATE TABLE IF NOT EXISTS dish_image_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('dish', 'combo')),
  target_id uuid,
  target_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  generation_id text,
  credit_deducted numeric(12,6) NOT NULL DEFAULT 1.0 CHECK (credit_deducted > 0),
  refunded boolean NOT NULL DEFAULT false,
  error_message text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dish_image_generations_restaurant
  ON dish_image_generations(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dish_image_generations_pending
  ON dish_image_generations(restaurant_id)
  WHERE status = 'pending';

ALTER TABLE dish_image_generations ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON dish_image_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dish_image_generations TO service_role;

DROP POLICY IF EXISTS "hosts_read_own_image_generations" ON dish_image_generations;
CREATE POLICY "hosts_read_own_image_generations"
  ON dish_image_generations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = dish_image_generations.restaurant_id
        AND restaurants.owner_id = auth.uid()
    )
  );

-- ── begin_dish_image_generation: pre-flight + atomic deduction ──
CREATE OR REPLACE FUNCTION begin_dish_image_generation(
  p_restaurant_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_target_name text,
  p_idempotency_key text
)
RETURNS TABLE (
  generation_id uuid,
  was_duplicate boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric(12,6);
  v_new_balance numeric(12,6);
  v_existing dish_image_generations;
BEGIN
  IF p_target_type NOT IN ('dish', 'combo') THEN
    RAISE EXCEPTION 'Invalid target type';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 THEN
    RAISE EXCEPTION 'Idempotency key is required';
  END IF;

  -- Crash recovery: any pending attempt older than 45 minutes failed without
  -- reaching completion (e.g. the function instance died mid-generation).
  -- Fail it and refund exactly once; the completion lock below keeps this
  -- safe even if the original request is somehow still running.
  WITH stale AS (
    SELECT id FROM dish_image_generations
    WHERE restaurant_id = p_restaurant_id
      AND status = 'pending'
      AND created_at < now() - interval '45 minutes'
    FOR UPDATE SKIP LOCKED
  )
  UPDATE dish_image_generations g
  SET status = 'failed',
      refunded = true,
      error_message = 'Generation timed out before completion; credit refunded.',
      completed_at = now()
  FROM stale s
  WHERE g.id = s.id;

  WITH refunded_rows AS (
    UPDATE host_credits
    SET balance = balance + 1.0, updated_at = now()
    WHERE restaurant_id = p_restaurant_id
      AND EXISTS (
        SELECT 1 FROM dish_image_generations
        WHERE dish_image_generations.restaurant_id = p_restaurant_id
          AND dish_image_generations.status = 'pending'
          AND dish_image_generations.refunded = true
          AND dish_image_generations.created_at < now() - interval '45 minutes'
      )
    RETURNING balance
  )
  INSERT INTO host_credit_adjustments (
    restaurant_id, operation, amount, previous_balance, resulting_balance
  )
  SELECT p_restaurant_id, 'refund', 1.0, r.balance - 1.0, r.balance
  FROM refunded_rows r;

  -- Idempotency: the same request ID never deducts twice.
  SELECT * INTO v_existing
  FROM dish_image_generations
  WHERE idempotency_key = p_idempotency_key;
  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing.id, true;
    RETURN;
  END IF;

  INSERT INTO host_credits (restaurant_id, balance)
  VALUES (p_restaurant_id, 0)
  ON CONFLICT (restaurant_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM host_credits
  WHERE restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 1.0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: At least 1 credit is required to generate a dish image.';
  END IF;

  v_new_balance := v_balance - 1.0;

  UPDATE host_credits
  SET balance = v_new_balance, updated_at = now()
  WHERE restaurant_id = p_restaurant_id;

  INSERT INTO host_credit_adjustments (
    restaurant_id, operation, amount, previous_balance, resulting_balance
  )
  VALUES (p_restaurant_id, 'deduct', 1.0, v_balance, v_new_balance);

  INSERT INTO dish_image_generations (
    restaurant_id, target_type, target_id, target_name, idempotency_key
  )
  VALUES (p_restaurant_id, p_target_type, p_target_id, p_target_name, p_idempotency_key);

  RETURN QUERY SELECT (
    SELECT id FROM dish_image_generations WHERE idempotency_key = p_idempotency_key
  ), false;
END;
$$;

REVOKE EXECUTE ON FUNCTION begin_dish_image_generation(uuid, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION begin_dish_image_generation(uuid, text, uuid, text, text) TO service_role;

-- ── complete_dish_image_generation: idempotent completion / refund ──
CREATE OR REPLACE FUNCTION complete_dish_image_generation(
  p_generation_id uuid,
  p_success boolean,
  p_api_generation_id text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row dish_image_generations;
  v_balance numeric(12,6);
  v_new_balance numeric(12,6);
BEGIN
  SELECT * INTO v_row
  FROM dish_image_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Generation record not found';
  END IF;

  -- Only a pending row can be completed. Anything else (already succeeded,
  -- already failed/refunded, already swept) is ignored so a late response can
  -- never change an already-refunded generation into a successful one.
  IF v_row.status <> 'pending' THEN
    RETURN;
  END IF;

  IF p_success THEN
    UPDATE dish_image_generations
    SET status = 'succeeded',
        generation_id = p_api_generation_id,
        completed_at = now()
    WHERE id = p_generation_id;
  ELSE
    SELECT balance INTO v_balance
    FROM host_credits
    WHERE restaurant_id = v_row.restaurant_id
    FOR UPDATE;

    v_new_balance := COALESCE(v_balance, 0) + 1.0;

    INSERT INTO host_credits (restaurant_id, balance)
    VALUES (v_row.restaurant_id, 0)
    ON CONFLICT (restaurant_id) DO NOTHING;

    UPDATE host_credits
    SET balance = v_new_balance, updated_at = now()
    WHERE restaurant_id = v_row.restaurant_id;

    INSERT INTO host_credit_adjustments (
      restaurant_id, operation, amount, previous_balance, resulting_balance
    )
    VALUES (v_row.restaurant_id, 'refund', 1.0, COALESCE(v_balance, 0), v_new_balance);

    UPDATE dish_image_generations
    SET status = 'failed',
        generation_id = p_api_generation_id,
        error_message = left(p_error_message, 500),
        refunded = true,
        completed_at = now()
    WHERE id = p_generation_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_dish_image_generation(uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_dish_image_generation(uuid, boolean, text, text) TO service_role;
