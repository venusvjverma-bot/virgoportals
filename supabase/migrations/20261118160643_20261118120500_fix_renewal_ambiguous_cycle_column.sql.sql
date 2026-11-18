/*
# Fix ambiguous column in process_subscription_renewal

## Purpose
The function's RETURN TABLE column `cycle_number` collides with
`subscription_payments.cycle_number` inside the MAX() aggregate, causing
"column reference cycle_number is ambiguous" at runtime — the reservation
step of renewal processing crashes.

## Change
Qualify the column with the table name in the aggregate. No behavior change
other than making the function runnable.
*/

CREATE OR REPLACE FUNCTION public.process_subscription_renewal(p_subscription_id uuid)
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

  SELECT coalesce(MAX(sp.cycle_number), 0) + 1 INTO v_next_cycle
    FROM subscription_payments AS sp WHERE sp.subscription_id = v_sub.id;

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

REVOKE EXECUTE ON FUNCTION public.process_subscription_renewal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_subscription_renewal(uuid) TO service_role;
