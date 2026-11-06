-- Simplified order lifecycle: new → accepted → completed, cancelled from new/accepted.
-- preparing and ready are retired; no live orders exist in those states (verified 0 rows),
-- so narrowing the CHECK constraint is safe and preserves all history.

CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id uuid, p_new_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_order RECORD;
v_allowed boolean;
BEGIN
SELECT status, restaurant_id INTO v_order
FROM public.orders WHERE id = p_order_id;

IF NOT FOUND THEN
RAISE EXCEPTION 'Order not found';
END IF;

IF NOT public.owns_restaurant(v_order.restaurant_id) AND NOT public.is_admin() THEN
RAISE EXCEPTION 'You are not authorized to update this order';
END IF;

-- Simplified lifecycle: new → accepted → completed; cancel from new/accepted.
v_allowed := false;
IF v_order.status = 'new' AND p_new_status IN ('accepted','cancelled') THEN
v_allowed := true;
ELSIF v_order.status = 'accepted' AND p_new_status IN ('completed','cancelled') THEN
v_allowed := true;
ELSIF v_order.status = 'completed' AND p_new_status = 'completed' THEN
-- No-op, allow idempotent
v_allowed := true;
END IF;

IF NOT v_allowed THEN
RAISE EXCEPTION 'Invalid status transition from % to %', v_order.status, p_new_status;
END IF;

UPDATE public.orders
SET status = p_new_status,
status_updated_at = now(),
updated_at = now()
WHERE id = p_order_id;

INSERT INTO public.order_status_log (order_id, from_status, to_status, changed_by)
VALUES (p_order_id, v_order.status, p_new_status, auth.uid());

RETURN true;
END;
$function$;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new','accepted','completed','cancelled'));
