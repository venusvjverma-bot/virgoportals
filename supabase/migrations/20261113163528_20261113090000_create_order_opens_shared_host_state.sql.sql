/*
# Shared Host order-opened state (order_opens)

1. New Tables
- `order_opens`: one record per opened order, shared across every device signed in to the same Host account.
  - `id` (uuid, primary key, default gen_random_uuid())
  - `order_id` (uuid, not null, unique) — references public.orders(id) ON DELETE CASCADE. The unique constraint guarantees exactly one shared "opened" record per order.
  - `restaurant_id` (uuid, not null) — references public.restaurants(id) ON DELETE CASCADE. Used for access scoping and realtime filtering.
  - `opened_by` (uuid, nullable) — references auth.users(id) ON DELETE SET NULL; the authenticated Host who opened the order.
  - `opened_at` (timestamptz, not null, default now()) — when the order was first opened.

2. Indexes
- Unique constraint on `order_id` (one opened record per order; duplicate inserts are treated as no-ops by the client).
- `idx_order_opens_restaurant` on `restaurant_id` for list lookups and realtime filters.
- `idx_order_opens_opened_at` on `opened_at DESC` for recent-activity queries.

3. Security
- Row Level Security enabled on `order_opens`.
- SELECT and INSERT granted to `authenticated` only (Host dashboards require sign-in).
- SELECT policy `hosts_read_own_order_opens`: Hosts can read open records only for restaurants they own (restaurants.owner_id = auth.uid()).
- INSERT policy `hosts_insert_own_order_opens`: Hosts can only record opens for restaurants they own.
- No UPDATE or DELETE policies: opened state is append-only and immutable once written.

4. Realtime
- `order_opens` added to the `supabase_realtime` publication so opening an order on one device updates other devices live.

5. Notes
- Duplicate inserts are prevented by the unique constraint on `order_id`; the client uses upsert with ignoreDuplicates for idempotency.
- Replaces the per-device localStorage key `vp:host:opened-orders:<restaurantId>` as the authoritative store for opened-order state.
*/

CREATE TABLE IF NOT EXISTS order_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders (id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
  opened_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_opens_restaurant ON order_opens (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_opens_opened_at ON order_opens (opened_at DESC);

ALTER TABLE order_opens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON order_opens TO authenticated;

DROP POLICY IF EXISTS "hosts_read_own_order_opens" ON order_opens;
CREATE POLICY "hosts_read_own_order_opens"
ON order_opens FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = order_opens.restaurant_id
      AND restaurants.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "hosts_insert_own_order_opens" ON order_opens;
CREATE POLICY "hosts_insert_own_order_opens"
ON order_opens FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM restaurants
    WHERE restaurants.id = order_opens.restaurant_id
      AND restaurants.owner_id = auth.uid()
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_opens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_opens;
  END IF;
END $$;
