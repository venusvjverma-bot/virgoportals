/*
# Add host_credits and host_credit_adjustments to realtime publication

## Purpose
The Host Credit Wallet subscribes to `postgres_changes` events on the
`host_credits` and `host_credit_adjustments` tables so the balance updates
live as visitors use the chat (which deducts credits) and after admin
adjustments. Without this, the wallet only refreshes on page reload.

## Changes
1. Add `public.host_credits` to the `supabase_realtime` publication.
2. Add `public.host_credit_adjustments` to the `supabase_realtime` publication.

## Security
- No RLS or policy changes. Realtime still respects RLS: the host's
  subscription filter (`restaurant_id=eq.<their-id>`) combined with the
  SELECT policy means they only receive changes to their own row.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.host_credits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.host_credit_adjustments;
