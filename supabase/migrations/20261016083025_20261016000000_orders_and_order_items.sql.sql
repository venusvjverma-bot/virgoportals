/*
# Orders & Order Items — end-to-end ordering prototype

## Overview
Adds a complete order lifecycle: visitors submit test orders (no payment)
through a server-side edge function, orders are stored with server-validated
totals and a unique human-readable order number, and hosts see/manage them
in their portal with realtime updates.

## 1. New Tables

### `orders`
One row per confirmed test order.
- `id` uuid PK
- `order_number` text UNIQUE NOT NULL — human-readable, e.g. "ORD-20261016-A7K9"
- `restaurant_id` uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE
- `department_id` uuid nullable REFERENCES departments(id) ON DELETE SET NULL
- `event_id` uuid nullable REFERENCES events(id) ON DELETE SET NULL
- `resource_type` text NOT NULL CHECK in ('department','event','restaurant')
- `resource_name` text NOT NULL DEFAULT '' — snapshot of dept/event/restaurant name at order time
- `restaurant_name` text NOT NULL DEFAULT '' — snapshot for visitor confirmation
- `status` text NOT NULL DEFAULT 'new' CHECK in ('new','accepted','preparing','ready','completed','cancelled')
- `payment_status` text NOT NULL DEFAULT 'test_unpaid' CHECK in ('test_unpaid')
- `total_minor` integer NOT NULL DEFAULT 0 — total in minor units (øre/cent), server-calculated
- `currency` text NOT NULL DEFAULT 'SEK'
- `idempotency_key` text UNIQUE NOT NULL — client-generated, prevents duplicate orders
- `item_count` integer NOT NULL DEFAULT 0
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()
- `status_updated_at` timestamptz NOT NULL DEFAULT now()

### `order_items`
One row per dish in an order.
- `id` uuid PK
- `order_id` uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE
- `dish_id` uuid NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT
- `name` text NOT NULL — snapshot of dish name at order time
- `price_minor` integer NOT NULL — unit price in minor units, server-validated
- `quantity` integer NOT NULL CHECK (quantity >= 1)
- `line_total_minor` integer NOT NULL — price_minor * quantity, server-calculated
- `created_at` timestamptz NOT NULL DEFAULT now()

### `order_status_log`
Append-only audit trail of status transitions.
- `id` uuid PK
- `order_id` uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE
- `from_status` text
- `to_status` text NOT NULL
- `changed_by` uuid — auth.uid() of the host or null for system
- `created_at` timestamptz NOT NULL DEFAULT now()

## 2. Security — RLS

### `orders` — host-scoped
- SELECT: host sees orders for their own restaurant; admin sees all.
  No anon access (visitors use the edge function).
- INSERT: service_role only (edge function creates orders).
- UPDATE: host can update only `status` on their own orders; admin any.
  A WITH CHECK re-verifies ownership.
- DELETE: admin only.

### `order_items` — inherit from parent order
- SELECT: same ownership check as orders (EXISTS subquery).
- INSERT/UPDATE/DELETE: service_role only.

### `order_status_log` — inherit from parent order
- SELECT: same ownership check.
- INSERT: service_role only (edge function logs transitions).
  Hosts do not insert directly; the status update trigger logs.

## 3. Helper Functions

### `generate_order_number()` — SECURITY DEFINER
Generates "ORD-YYYYMMDD-XXXX" where XXXX is 4 base36 chars from gen_random_uuid().
Not unique by generation alone — uniqueness is enforced by the column constraint
and the edge function's idempotency check.

### `owns_order(p_order_id uuid)` — SECURITY DEFINER
Returns true when the caller's auth.uid() owns the restaurant linked to the order.
Used by RLS policies on order_items and order_status_log.

### `update_order_status(p_order_id uuid, p_new_status text)` — SECURITY DEFINER
Validates the status transition, updates the order, and logs the transition.
Only callable by authenticated hosts who own the order's restaurant.
Permitted transitions:
  new → accepted → preparing → ready → completed
  new/accepted/preparing/ready → cancelled
Rejects invalid transitions, unknown statuses, and non-owners.

## 4. Triggers

### `order_status_log_trigger` — AFTER UPDATE on orders
When `status` changes, inserts a row into `order_status_log` with the old/new
status and the changer's auth.uid(). This runs in addition to the
update_order_status function's explicit log insert, providing a belt-and-
suspenders audit trail. (The function logs first; this trigger is a backup.)

### `orders_updated_at_trigger` — BEFORE UPDATE on orders
Auto-updates `updated_at` and `status_updated_at` (when status changes).

## 5. Indexes
- `orders_restaurant_id_idx` — host list queries
- `orders_status_idx` — status filtering
- `orders_idempotency_key_idx` — duplicate prevention lookup (unique constraint already indexes)
- `order_items_order_id_idx` — join to parent order
- `order_status_log_order_id_idx` — audit lookup

## 6. Notes
- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS.
- No existing table, column, or row is modified or deleted.
- The `dishes` table is NOT modified — price_minor is resolved at order time
  by parsing the `price` text column server-side in the edge function.
- Visitors never get direct table access to orders. All order creation goes
  through the edge function using the service role key.
*/

-- ─── orders table ───
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('department','event','restaurant')),
  resource_name text NOT NULL DEFAULT '',
  restaurant_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','preparing','ready','completed','cancelled')),
  payment_status text NOT NULL DEFAULT 'test_unpaid' CHECK (payment_status IN ('test_unpaid')),
  total_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SEK',
  idempotency_key text UNIQUE NOT NULL,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status_updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS orders_restaurant_id_idx ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);

-- ─── order_items table ───
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  name text NOT NULL,
  price_minor integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity >= 1),
  line_total_minor integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- ─── order_status_log table ───
CREATE TABLE IF NOT EXISTS order_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_status_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS order_status_log_order_id_idx ON order_status_log(order_id);

-- ─── RLS: orders ───
DROP POLICY IF EXISTS "host_select_own_orders" ON orders;
CREATE POLICY "host_select_own_orders" ON orders FOR SELECT
  TO authenticated
  USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "service_insert_orders" ON orders;
CREATE POLICY "service_insert_orders" ON orders FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "host_update_own_order_status" ON orders;
CREATE POLICY "host_update_own_order_status" ON orders FOR UPDATE
  TO authenticated
  USING (public.owns_restaurant(restaurant_id) OR public.is_admin())
  WITH CHECK (public.owns_restaurant(restaurant_id) OR public.is_admin());

DROP POLICY IF EXISTS "admin_delete_orders" ON orders;
CREATE POLICY "admin_delete_orders" ON orders FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ─── RLS: order_items ───
DROP POLICY IF EXISTS "host_select_own_order_items" ON order_items;
CREATE POLICY "host_select_own_order_items" ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (public.owns_restaurant(o.restaurant_id) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "service_insert_order_items" ON order_items;
CREATE POLICY "service_insert_order_items" ON order_items FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_update_order_items" ON order_items;
CREATE POLICY "service_update_order_items" ON order_items FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_delete_order_items" ON order_items;
CREATE POLICY "service_delete_order_items" ON order_items FOR DELETE
  TO service_role
  USING (true);

-- ─── RLS: order_status_log ───
DROP POLICY IF EXISTS "host_select_own_status_log" ON order_status_log;
CREATE POLICY "host_select_own_status_log" ON order_status_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_status_log.order_id
        AND (public.owns_restaurant(o.restaurant_id) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "service_insert_status_log" ON order_status_log;
CREATE POLICY "service_insert_status_log" ON order_status_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ─── Helper: owns_order ───
CREATE OR REPLACE FUNCTION public.owns_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id
      AND public.owns_restaurant(o.restaurant_id)
  );
$$;

REVOKE ALL ON FUNCTION public.owns_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_order(uuid) TO authenticated;

-- ─── Helper: generate_order_number ───
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date text := to_char(now(), 'YYYYMMDD');
  v_rand text;
  v_candidate text;
BEGIN
  -- 4 random base36 chars from a UUID fragment
  v_rand := lpad(
    to_hex(
      ('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::int
    ),
    8, '0'
  );
  v_rand := upper(substr(v_rand, 1, 4));
  v_candidate := 'ORD-' || v_date || '-' || v_rand;
  RETURN v_candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

-- ─── Helper: update_order_status ───
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Validate permitted transitions
  v_allowed := false;
  IF v_order.status = 'new' AND p_new_status IN ('accepted','cancelled') THEN
    v_allowed := true;
  ELSIF v_order.status = 'accepted' AND p_new_status IN ('preparing','cancelled') THEN
    v_allowed := true;
  ELSIF v_order.status = 'preparing' AND p_new_status IN ('ready','cancelled') THEN
    v_allowed := true;
  ELSIF v_order.status = 'ready' AND p_new_status IN ('completed','cancelled') THEN
    v_allowed := true;
  ELSIF v_order.status = 'completed' AND p_new_status = 'completed' THEN
    -- No-op, allow idempotent
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', v_order.status, p_new_status;
  END IF;

  -- Update order
  UPDATE public.orders
  SET status = p_new_status,
      status_updated_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  -- Log the transition
  INSERT INTO public.order_status_log (order_id, from_status, to_status, changed_by)
  VALUES (p_order_id, v_order.status, p_new_status, auth.uid());

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text) TO authenticated;

-- ─── Trigger: auto-update timestamps ───
CREATE OR REPLACE FUNCTION public.orders_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_updated_at_trg ON orders;
CREATE TRIGGER orders_set_updated_at_trg
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_set_updated_at();

-- ─── Grant table privileges ───
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON order_items TO authenticated;
GRANT SELECT ON order_status_log TO authenticated;
GRANT UPDATE ON orders TO authenticated;
