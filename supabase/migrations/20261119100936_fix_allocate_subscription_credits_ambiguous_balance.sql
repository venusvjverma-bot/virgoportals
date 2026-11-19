-- Fix: the 6-arg allocate_subscription_credits returns a column named
-- "balance" (RETURNS TABLE), which collides with host_credits.balance when
-- referenced unqualified inside the function body. Every call failed with
-- 42702 "column reference balance is ambiguous", so webhook-driven
-- subscription activation, credit allocation, and payment recording never
-- completed. Qualify the column references; logic is unchanged.

CREATE OR REPLACE FUNCTION public.allocate_subscription_credits(
  p_restaurant_id uuid,
  p_package_id uuid,
  p_cycle_number integer,
  p_provider_payment_ref text,
  p_vat_cents integer DEFAULT NULL::integer,
  p_total_cents integer DEFAULT NULL::integer
)
RETURNS TABLE(allocated boolean, balance numeric, period_end timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
RETURN QUERY SELECT false, (SELECT hc.balance FROM host_credits hc WHERE hc.restaurant_id = p_restaurant_id), v_subscription.period_end;
RETURN;
END IF;

IF v_existing.id IS NOT NULL THEN
UPDATE subscription_payments
SET status = 'succeeded',
provider_payment_ref = p_provider_payment_ref,
paid_at = now(),
amount_cents = COALESCE(p_total_cents, amount_cents),
vat_cents = COALESCE(p_vat_cents, vat_cents),
total_cents = COALESCE(p_total_cents, total_cents)
WHERE id = v_existing.id;
ELSE
-- No reservation exists (direct webhook confirmation path): create the
-- succeeded row exactly as before.
INSERT INTO subscription_payments (
subscription_id, package_id, cycle_number, amount_cents, currency,
vat_cents, total_cents,
status, provider, provider_payment_ref, paid_at
) VALUES (
v_subscription.id, p_package_id, p_cycle_number,
COALESCE(p_total_cents, v_package.price_cents), 'SEK',
p_vat_cents, p_total_cents,
'succeeded', v_subscription.provider, p_provider_payment_ref, now()
);
END IF;

-- Add to the existing wallet (never reset). Creates a zero row if missing.
INSERT INTO host_credits (restaurant_id, balance)
VALUES (p_restaurant_id, 0)
ON CONFLICT (restaurant_id) DO NOTHING;

SELECT hc.balance INTO v_balance FROM host_credits hc
WHERE hc.restaurant_id = p_restaurant_id FOR UPDATE;

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
$function$;
