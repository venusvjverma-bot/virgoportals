/*
# Fix subscription period advance to preserve the billing anchor

## Purpose
Bug fix found during the subscription audit: `allocate_subscription_credits`
computed the next `period_end` from the *current date* (`now()` month + 1).
For on-time renewals this equals the anchor date, but if a renewal is
processed late (e.g. after a scheduler outage), the period end would be
pushed forward from "today" instead of from the anchor, permanently drifting
the billing date away from the agreed anchor day.

## Change
The function now derives the new `period_end` from the subscription's current
`period_end` (the paid period), advancing exactly one month and clamping the
billing anchor day to the target month's last day. The anchor day is stable
forever: anchor 31 → Jan 31 paid period → Feb 28 → Mar 31 → ... (no drift).
`period_start` remains the previous `period_end`.

## Objects modified
- `allocate_subscription_credits(uuid, uuid, integer, text)` — period
  computation block only. Credit allocation, idempotency guard, wallet
  integration, and audit writes are unchanged.

## Security
Unchanged: SECURITY DEFINER, service_role only, REVOKE from PUBLIC/anon/authenticated.
*/

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
  v_base timestamptz;
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

  -- Advance the period from the CURRENT PAID PERIOD (not from now()), so the
  -- billing anchor never drifts even when a renewal is processed late.
  -- Anchor day is clamped to the target month's last day (Jan 31 → Feb 28/29).
  v_base := coalesce(v_subscription.period_end, now());
  v_target_year := EXTRACT(YEAR FROM v_base)::int;
  v_target_month := EXTRACT(MONTH FROM v_base)::int + 1;
  IF v_target_month > 12 THEN
    v_target_month := 1;
    v_target_year := v_target_year + 1;
  END IF;
  v_last_day := EXTRACT(DAY FROM
    (date_trunc('month', make_date(v_target_year, v_target_month, 1)) + interval '1 month - 1 day')::date);
  v_new_period_end := make_timestamptz(
    v_target_year, v_target_month, LEAST(v_subscription.billing_anchor_day, v_last_day),
    12, 0, 0, 'UTC'
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
