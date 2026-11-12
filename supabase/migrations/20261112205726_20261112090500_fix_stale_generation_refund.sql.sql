/*
# Fix stale-generation refund in begin_dish_image_generation

1. Purpose
Corrects the crash-recovery sweep in `begin_dish_image_generation`. The
previous version marked stale pending rows as failed and then tried to refund
by re-selecting rows still marked 'pending' — a condition that could never
match after the status update, so the credit was never actually returned.

2. Changes
- Replaces `begin_dish_image_generation` with a corrected implementation that,
  for each stale pending row (locked FOR UPDATE): refunds 1 credit, writes one
  'refund' audit row, and marks the row failed — all before the idempotency
  and deduction steps.
- The completion function and all grants/RLS are unchanged.
*/

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
  v_stale record;
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
  -- Fail it and refund exactly once, before the new attempt is priced.
  FOR v_stale IN
    SELECT id
    FROM dish_image_generations
    WHERE restaurant_id = p_restaurant_id
      AND status = 'pending'
      AND created_at < now() - interval '45 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT balance INTO v_balance
    FROM host_credits
    WHERE restaurant_id = p_restaurant_id
    FOR UPDATE;

    v_new_balance := COALESCE(v_balance, 0) + 1.0;

    INSERT INTO host_credits (restaurant_id, balance)
    VALUES (p_restaurant_id, 0)
    ON CONFLICT (restaurant_id) DO NOTHING;

    UPDATE host_credits
    SET balance = v_new_balance, updated_at = now()
    WHERE restaurant_id = p_restaurant_id;

    INSERT INTO host_credit_adjustments (
      restaurant_id, operation, amount, previous_balance, resulting_balance
    )
    VALUES (p_restaurant_id, 'refund', 1.0, COALESCE(v_balance, 0), v_new_balance);

    UPDATE dish_image_generations
    SET status = 'failed',
        refunded = true,
        error_message = 'Generation timed out before completion; credit refunded.',
        completed_at = now()
    WHERE id = v_stale.id;
  END LOOP;

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
