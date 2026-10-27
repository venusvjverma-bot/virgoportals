/*
# Fix: Revoke EXECUTE on order helper functions from anon and authenticated

The SECURITY DEFINER functions created for the ordering system were
inadvertently executable by anon and authenticated roles via the REST
API. This migration revokes EXECUTE from anon/authenticated on:
- generate_order_number() — service_role only (edge function)
- orders_set_updated_at() — trigger function, no direct call needed
- owns_order(uuid) — authenticated only (used by RLS policies, but
  should not be callable directly via REST)
- update_order_status(uuid, text) — authenticated only (but should
  only be called through the edge function, not directly via REST)

Note: owns_order and update_order_status still need EXECUTE granted to
`authenticated` because RLS policy evaluation calls them. However, the
REST API endpoint exposure is the concern. The `GRANT EXECUTE TO
authenticated` is needed for RLS internals but the function still
checks ownership internally. For generate_order_number and
orders_set_updated_at, EXECUTE is revoked from both anon and
authenticated and granted only to service_role.
*/

-- generate_order_number: service_role only
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

-- orders_set_updated_at: trigger function, revoke from all non-service roles
REVOKE EXECUTE ON FUNCTION public.orders_set_updated_at() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_set_updated_at() TO service_role;

-- owns_order: keep authenticated grant (RLS needs it), revoke from anon
REVOKE EXECUTE ON FUNCTION public.owns_order(uuid) FROM anon;

-- update_order_status: keep authenticated grant (RLS + edge function needs it), revoke from anon
REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text) FROM anon;
