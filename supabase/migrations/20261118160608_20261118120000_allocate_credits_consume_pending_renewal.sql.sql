/*
# Renewal allocation consumes the pending payment reservation

## Purpose
Targeted bug fix for the renewal flow. `process_subscription_renewal`
(reservation step) inserts a `subscription_payments` row with status
'pending' carrying the package's current SEK price. But
`allocate_subscription_credits` (confirmation step) treated ANY existing row
for the cycle as "already paid" and returned `allocated = false`. The result:
even after a successful provider charge, the renewal could never allocate
credits or extend the period — the cycle stayed pending forever.

## Change
- `allocate_subscription_credits(uuid, uuid, integer, text)` now distinguishes
  the states:
  - existing row status 'succeeded' → true duplicate (webhook replay):
    return `allocated = false`, unchanged behavior.
  - existing row status 'failed' → cycle was previously declined; treat as
    not allocatable (`allocated = false`), unchanged behavior.
  - existing row status 'pending' → the reserved cycle being confirmed:
    UPDATE that row to 'succeeded' with the provider payment reference and
    paid_at, then proceed with credit allocation + period extension.
    The row's original amount_cents/currency (written at reservation time
    from the package price) are preserved, so the saved payment record keeps
    the correct amount.
- Nothing else changes: credit math, wallet integration, audit writes,
  period-anchor computation, SECURITY DEFINER, and service-role-only grants
  are untouched.

## Security
Unchanged: SECURITY DEFINER, search_path = public, EXECUTE revoked from
PUBLIC/anon/authenticated and granted to service_role only.
*/

CREATE OR REPLACE FUNCTION public.allocate_subscription_credits(
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
  -- cycle was paid". A 'succeeded' row means the webhook was replayed or the
  -- charge was already confirmed; a 'failed' row means the charge was
  -- declined and must not be re-confirmed here. A 'pending' row is the
  -- reservation created by process_subscription_renewal: this call confirms
  -- it after a successful charge.
  SELECT * INTO v_existing FROM subscription_payments
    WHERE subscription_id = v_subscription.id
      AND cycle_number = p_cycle_number;
  IF v_existing.id IS NOT NULL AND v_existing.status <> 'pending' THEN
    RETURN QUERY SELECT false, (SELECT balance FROM host_credits WHERE restaurant_id = p_restaurant_id), v_subscription.period_end;
    RETURN;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE subscription_payments
      SET status = 'succeeded',
          provider_payment_ref = p_provider_payment_ref,
          paid_at = now()
    WHERE id = v_existing.id;
  ELSE
    -- No reservation exists (direct webhook confirmation path): create the
    -- succeeded row exactly as before.
    INSERT INTO subscription_payments (
      subscription_id, package_id, cycle_number, amount_cents, currency,
      status, provider, provider_payment_ref, paid_at
    ) VALUES (
      v_subscription.id, p_package_id, p_cycle_number, v_package.price_cents, 'SEK',
      'succeeded', v_subscription.provider, p_provider_payment_ref, now()
    );
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.allocate_subscription_credits(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_subscription_credits(uuid, uuid, integer, text) TO service_role;
