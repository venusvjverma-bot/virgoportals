/*
# Add server-side LLM usage summary functions

## Plain-English summary
The Host dashboard previously downloaded every raw token-usage record into the browser and added them up there. The database API returns at most 1,000 records per request and the requests had no ordering, so large accounts saw incomplete and changing totals. This migration adds two read-only database functions that do the arithmetic on the database side and return only a handful of numbers.

## New functions
1. `get_llm_usage_daily(p_restaurant_id uuid)`
   - Returns exactly seven rows, one per calendar date, oldest first, ending with today in the restaurant's configured timezone.
   - Each row has `usage_date`, `daily_input_tokens` and `daily_output_tokens`.
   - Dates with no usage are returned with zeros.
   - Day boundaries follow the restaurant's `timezone` column (empty values fall back to UTC).
2. `get_llm_usage_totals(p_restaurant_id uuid)`
   - Returns one row with `total_input_tokens` and `total_output_tokens` across all recorded usage for the restaurant.

## Tables modified
None. No data is changed, copied or created. Token recording is unchanged.

## Security changes
- Both functions use SECURITY INVOKER (the default). They run with the caller's permissions, so the existing row level security rules on `llm_usage` and `restaurants` still decide what is visible: a Host sees only their own restaurant, and an administrator sees all restaurants, exactly as before.
- If the caller cannot see the requested restaurant, the functions raise "Restaurant not found" instead of returning numbers.
- EXECUTE is revoked from PUBLIC and anon and granted to authenticated only.
- No table grants or policies were changed.

## Important notes
1. Both functions are STABLE and read-only; they cannot insert, update or delete any row.
2. The daily function is the only source for the seven-day graph, and the totals function is the only source for the dashboard counters, so both views read from the same underlying records.
3. The functions compute on the server, so no matter how many usage records exist the result is complete.
*/

CREATE OR REPLACE FUNCTION public.get_llm_usage_daily(p_restaurant_id uuid)
RETURNS TABLE (
  usage_date date,
  daily_input_tokens bigint,
  daily_output_tokens bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
  v_today date;
  v_window_start timestamptz;
BEGIN
  SELECT coalesce(nullif(r.timezone, ''), 'UTC')
    INTO v_timezone
    FROM restaurants r
    WHERE r.id = p_restaurant_id;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found' USING ERRCODE = '42501';
  END IF;

  v_today := (now() AT TIME ZONE v_timezone)::date;
  v_window_start := (v_today - 6)::timestamp AT TIME ZONE v_timezone;

  RETURN QUERY
  SELECT
    d.day::date,
    coalesce(sum(u.input_tokens), 0)::bigint,
    coalesce(sum(u.output_tokens), 0)::bigint
  FROM generate_series(v_today - 6, v_today, interval '1 day') AS d(day)
  LEFT JOIN llm_usage u
    ON u.restaurant_id = p_restaurant_id
   AND u.created_at >= v_window_start
   AND (u.created_at AT TIME ZONE v_timezone)::date = d.day::date
  GROUP BY d.day
  ORDER BY d.day;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_llm_usage_totals(p_restaurant_id uuid)
RETURNS TABLE (
  total_input_tokens bigint,
  total_output_tokens bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM restaurants r WHERE r.id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(sum(u.input_tokens), 0)::bigint,
    coalesce(sum(u.output_tokens), 0)::bigint
  FROM llm_usage u
  WHERE u.restaurant_id = p_restaurant_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_llm_usage_daily(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_llm_usage_daily(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_llm_usage_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_llm_usage_totals(uuid) TO authenticated;
