-- Remove the legacy 4-arg allocate_subscription_credits overload. It is
-- superseded by the 6-arg version (VAT/total fields) and has no callers left,
-- but its existence makes RPC resolution fragile and its "balance" ambiguity
-- class of bugs easy to reintroduce.

DROP FUNCTION IF EXISTS public.allocate_subscription_credits(uuid, uuid, integer, text);
