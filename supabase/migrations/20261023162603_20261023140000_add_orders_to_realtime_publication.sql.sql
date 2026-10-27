/*
# Add orders table to supabase_realtime publication

## Purpose
The Host Orders page subscribes to Supabase Realtime `postgres_changes` events
on the `orders` table to receive live INSERT and UPDATE notifications. However,
the `supabase_realtime` publication currently contains zero application tables,
so no change events are ever broadcast. This migration adds `public.orders` to
the publication so that the existing client-side subscription works.

## Changes
1. Add `public.orders` to the `supabase_realtime` publication.
   - Uses `ALTER PUBLICATION ... ADD TABLE` which is idempotent-safe: if the
     table is already in the publication, Postgres ignores the duplicate.
   - Only the `orders` table is added — the Host Orders subscription listens
     to this table only.

## Security
- No RLS or policy changes. Realtime still respects RLS: the host's
  authenticated session only receives events for rows they can SELECT
  (via the existing `host_select_own_orders` policy using
  `owns_restaurant(restaurant_id)`). Restaurant isolation is preserved.
- No grants changed.

## Important notes
1. This is the root cause fix identified in the prior inspection report.
2. The client code in `OrdersView.tsx` is already correct — no code changes
   are needed for the subscription itself.
3. `order_items` is NOT added because the subscription only listens to
   `orders`. If item-level live updates are needed later, add that table
   separately.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
