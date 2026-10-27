/*
# Add mobile_number column to orders table

## Purpose
Every order must store a valid mobile number (in E.164 international format)
submitted by the visitor at checkout. This migration adds a nullable column
to avoid breaking historical orders, then enforces format validation via a
CHECK constraint that allows NULLs (for historical rows) but validates any
non-null value.

## Changes
1. New column on `orders`:
   - `mobile_number` (text) — the normalized E.164 mobile number associated
     with this specific order. Nullable so existing orders are not broken.
2. A CHECK constraint `orders_mobile_number_format` ensures that any
   non-null value matches the E.164 pattern (+ followed by 6–15 digits).
   This validates new inserts without rejecting historical NULLs.
3. No RLS or grant changes — the column is covered by the existing order
   policies and grants. The `service_role` (used by the edge function)
   bypasses RLS and already has full table access.

## Important notes
1. Existing orders keep `mobile_number = NULL` and are unaffected.
2. The edge function enforces that new orders MUST include a valid
   `mobile_number` — the database constraint is a safety net, not the
   primary validation.
3. The column is NOT indexed (not queried for lookups in this task).
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS mobile_number text;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_mobile_number_format;

ALTER TABLE orders
  ADD CONSTRAINT orders_mobile_number_format
  CHECK (
    mobile_number IS NULL
    OR mobile_number ~ '^\+[1-9][0-9]{5,14}$'
  );
